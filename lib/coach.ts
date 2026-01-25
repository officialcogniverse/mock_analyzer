import OpenAI from "openai";
import { z } from "zod";
import type { CoachCitation, CoachMode } from "@/lib/contracts";
const COACH_MODEL = process.env.OPENAI_COACH_MODEL || "gpt-4.1-mini";

const CoachLLMResponseSchema = z
  .object({
    answer: z.string().min(1),
    citations: z
      .array(
        z.object({
          type: z.enum(["pattern", "action", "metric", "comparison"]),
          ref: z.string().min(1),
          label: z.string().min(1),
        })
      )
      .min(1),
  })
  .strict();

type CoachContext = {
  exam: string;
  attemptId: string;
  summary: string;
  patterns: Array<{ id: string; title: string; evidence: string }>;
  actions: Array<{ id: string; title: string; status: "pending" | "completed"; reflection?: string }>;
  metrics: Array<{ label: string; value: string }>;
  comparison?: {
    previousAttemptId: string;
    deltaScorePct: number | null;
    trendLabel: string;
  };
};

function safePercent(value: any, max: any) {
  const v = Number(value);
  const m = Number(max);
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return null;
  return Math.round((v / m) * 100);
}

function metric(label: string, value: any) {
  if (value == null || value === "") return null;
  return { label, value: String(value) };
}

export function buildCoachContext(params: {
  attemptId: string;
  exam: string;
  report: any;
  actionStates: Array<{ actionId?: string; id?: string; title: string; status: "pending" | "completed"; reflection?: string }>;
  previousAttempt?: { id: string; report: any } | null;
}): CoachContext {
  const report = params.report || {};
  const estimated = report?.estimated_score || {};

  const patterns = (Array.isArray(report.patterns) ? report.patterns : [])
    .slice(0, 5)
    .map((pattern: any, idx: number) => ({
      id: String(pattern?.id || `pattern-${idx + 1}`),
      title: String(pattern?.title || "Execution pattern").trim(),
      evidence: String(pattern?.evidence || pattern?.impact || "Evidence not provided.").trim(),
    }));

  const metrics = [
    metric("Estimated score", estimated?.value != null ? `${estimated.value}/${estimated.max ?? "?"}` : null),
    metric("Percentile", report?.percentile),
    metric("Accuracy", report?.accuracy ?? report?.accuracy_pct),
    metric("FocusXP", report?.meta?.focusXP),
    metric("Confidence band", report?.meta?.strategy?.confidence_band),
  ].filter((m): m is { label: string; value: string } => Boolean(m));

  const prevScorePct = params.previousAttempt
    ? safePercent(params.previousAttempt.report?.estimated_score?.value, params.previousAttempt.report?.estimated_score?.max)
    : null;
  const currentScorePct = safePercent(estimated?.value, estimated?.max);

  const deltaScorePct =
    prevScorePct != null && currentScorePct != null ? currentScorePct - prevScorePct : null;

  const trendLabel =
    deltaScorePct == null ? "insufficient_delta_signal" : deltaScorePct > 2 ? "improving" : deltaScorePct < -2 ? "declining" : "flat";

  const comparison = params.previousAttempt
    ? {
        previousAttemptId: params.previousAttempt.id,
        deltaScorePct,
        trendLabel,
      }
    : undefined;

  return {
    exam: params.exam,
    attemptId: params.attemptId,
    summary: String(report.summary || "No summary available."),
    patterns,
    actions: params.actionStates.map((action, idx) => ({
      id: action.id || action.actionId || `action-${idx + 1}`,
      title: action.title,
      status: action.status,
      reflection: action.reflection,
    })),
    metrics,
    comparison,
  };
}

function modeInstruction(mode: CoachMode) {
  switch (mode) {
    case "explain_report":
      return "Explain the key performance story using 1-2 patterns, 1 metric, and 1 next action.";
    case "focus_today":
      return "Pick the single highest-leverage action for today and justify it using patterns + metrics.";
    case "score_not_improving":
      return "Diagnose stagnation using action adherence + comparison data, then prescribe a tighter action.";
    case "next_mock_strategy":
      return "Give a concrete attempt plan for the next mock based on the patterns and strategy signals.";
    case "am_i_improving":
      return "Judge whether the student is improving, stuck, or declining based on comparison + adherence.";
    default:
      return "Answer with grounded coaching guidance.";
  }
}

function buildSystemPrompt(mode: CoachMode) {
  return [
    "You are Cogniverse Coach, an evidence-bound performance coach.",
    "You are NOT a general chatbot.",
    "You can only use the provided evidence context.",
    "Every answer MUST reference at least one pattern, one action, or one metric.",
    "If evidence is missing, say what is missing and fall back to the safest next action.",
    "Return strict JSON with fields: answer, citations[].",
    modeInstruction(mode),
  ].join("\n");
}

function buildUserPrompt(params: { mode: CoachMode; message?: string; context: CoachContext }) {
  const ctx = params.context;
  const patternLines = ctx.patterns.map((p) => `- ${p.id}: ${p.title} | evidence: ${p.evidence}`).join("\n");
  const actionLines = ctx.actions
    .map(
      (a) =>
        `- ${a.id}: ${a.title} | status: ${a.status}${a.reflection ? ` | reflection: ${a.reflection}` : ""}`
    )
    .join("\n");
  const metricLines = ctx.metrics.map((m) => `- ${m.label}: ${m.value}`).join("\n");

  const comparisonLine = ctx.comparison
    ? `Previous attempt: ${ctx.comparison.previousAttemptId} | delta_score_pct: ${ctx.comparison.deltaScorePct ?? "null"} | trend: ${ctx.comparison.trendLabel}`
    : "Previous attempt: none";

  return [
    `Mode: ${params.mode}`,
    params.message ? `Student message: ${params.message}` : "Student message: (none provided)",
    `Exam: ${ctx.exam}`,
    `Attempt: ${ctx.attemptId}`,
    `Summary: ${ctx.summary}`,
    "Patterns:\n" + (patternLines || "- none"),
    "Actions:\n" + (actionLines || "- none"),
    "Metrics:\n" + (metricLines || "- none"),
    comparisonLine,
    "Citations rules: citations[].ref must be one of pattern ids, action ids, metric labels, or the previous attempt id.",
  ].join("\n\n");
}

function ensureGroundedCitations(context: CoachContext, citations: CoachCitation[]) {
  if (citations.length) return citations;

  if (context.patterns[0]) {
    return [
      {
        type: "pattern",
        ref: context.patterns[0].id,
        label: context.patterns[0].title,
      },
    ];
  }

  if (context.actions[0]) {
    return [
      {
        type: "action",
        ref: context.actions[0].id,
        label: context.actions[0].title,
      },
    ];
  }

  if (context.metrics[0]) {
    return [
      {
        type: "metric",
        ref: context.metrics[0].label,
        label: context.metrics[0].label,
      },
    ];
  }

  return [
    {
      type: "metric",
      ref: "missing_signal",
      label: "Insufficient evidence",
    },
  ];
}

export async function generateCoachReply(params: {
  mode: CoachMode;
  message?: string;
  context: CoachContext;
}) {
  const system = buildSystemPrompt(params.mode);
  const user = buildUserPrompt(params);

  if (!process.env.OPENAI_API_KEY) {
    return {
      answer:
        "AI coaching is temporarily unavailable. Focus on the top action in your list and retry once your workspace is configured.",
      citations: ensureGroundedCitations(params.context, []),
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: COACH_MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_output_tokens: 500,
  });

  const text = response.output_text?.trim();
  if (!text) {
    return {
      answer: "I could not generate a grounded response. Please retry.",
      citations: ensureGroundedCitations(params.context, []),
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { answer: text, citations: [] };
  }

  const validated = CoachLLMResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      answer: parsed?.answer || text,
      citations: ensureGroundedCitations(params.context, parsed?.citations || []),
    };
  }

  return {
    answer: validated.data.answer,
    citations: ensureGroundedCitations(params.context, validated.data.citations),
  };
}
