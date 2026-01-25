import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ReportSchema, type Report } from "./schema";
import { buildPrompt } from "./prompts";
import type { AnalyzeInput, StrategyMeta } from "./types";
import { z } from "zod";

/**
 * Model selection:
 * - Report generation can be cheaper (structure-heavy, less reasoning)
 * - Strategy plan should use the best reasoning model
 */
const REPORT_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-4o-mini";
const STRATEGY_MODEL = process.env.OPENAI_STRATEGY_MODEL || "gpt-4.1";

/**
 * ========= Strategy V2 Schema (actionable, constrained) =========
 * Kept separate from ReportSchema to avoid breaking existing UI.
 * We'll attach it under report.meta.strategy_plan.
 */
const StrategyPlanSchema = z
  .object({
    title: z.string(),
    confidence: z.object({
      score: z.number().min(0).max(100),
      band: z.enum(["high", "medium", "low"]),
      missing_signals: z.array(z.string()),
      assumptions: z.array(z.string()),
    }),

    top_levers: z
      .array(
        z.object({
          title: z.string(),
          do: z.array(z.string()).min(1),
          stop: z.array(z.string()).min(1),
          why: z.string(),
          metric: z.string(),
          next_mock_rule: z.string(),
        })
      )
      .min(1)
      .max(3),

    if_then_rules: z.array(z.string()).min(3).max(10),

    plan_days: z
      .array(
        z.object({
          day: z.number().min(1),
          title: z.string(),
          minutes: z.number().min(10).max(240),
          tasks: z.array(z.string()).min(2).max(8),
        })
      )
      .min(3)
      .max(14),

    next_questions: z
      .array(
        z.object({
          id: z.string(),
          question: z.string(),
          type: z.enum(["single_select", "boolean", "text"]),
          options: z.array(z.string()).optional(),
          unlocks: z.array(z.string()),
        })
      )
      .max(2),
  })
  .strict();

type StrategyPlan = z.infer<typeof StrategyPlanSchema>;

function safeText(x: any, max = 1600) {
  let s: string;
  try {
    s = typeof x === "string" ? x : JSON.stringify(x ?? "");
  } catch {
    s = String(x ?? "");
  }
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * ===== Master Prompt (UNCHANGED) =====
 */
const STRATEGY_MASTER_SYSTEM_PROMPT = `
SYSTEM ROLE:
You are an elite exam performance coach for standardized, high-stakes tests.
You optimize for measurable score uplift in the student's NEXT attempt, not long-term theory coverage.

You outperform human faculties by:
- Diagnosing execution failures, not syllabus gaps
- Acting decisively on limited, noisy, or incomplete data
- Issuing constraint-based, exam-time enforceable actions

PRIMARY OBJECTIVE:
Maximize expected score improvement in the student's NEXT attempt under realistic constraints.

OPERATING RULES:
1. Do NOT repeat scorecard or report facts.
   - Use them only internally to justify decisions.
2. Infer latent traits from available signals:
   - Risk appetite (under / over / calibrated)
   - Confidence calibration (inflated / suppressed / accurate)
   - Execution mode (systematic / reactive / impulsive)
   - Stability under pressure (stable / volatile / collapsing)
3. If data is missing or ambiguous:
   - Explicitly state assumptions
   - Proceed with robust, execution-safe fallback tactics
4. Use AT MOST THREE improvement levers.
   - Each lever must be constraint-based, measurable, and enforceable
5. Every recommendation must:
   - Change a decision the student makes DURING the exam
   - Be verifiable in the very next mock
6. Avoid generic advice entirely.
7. Prefer decision quality over content mastery.
8. Optimize for damage reduction before upside maximization.

DECISION QUALITY ENFORCEMENT:
- Think strictly in terms of decisions, not topics.
- Every action must map to an exam-time decision:
  (attempt / skip / delay / reorder / abandon).
- If an action cannot be verified in the NEXT attempt, it is invalid.

EXECUTION PRIORITY RULE:
- Prefer actions that REDUCE damage before actions that INCREASE upside.
- Assume most score loss comes from poor decisions, not lack of knowledge.

DATA ROBUSTNESS MODE:
- When scorecards, PDFs, or inputs are incomplete or noisy:
  - Default to execution-safe heuristics that historically improve outcomes
  - Do NOT ask for more data unless absolutely necessary
  - State assumptions clearly and proceed

FACULTY OVERRIDE:
- Ignore conventional coaching wisdom if it conflicts with data-backed execution logic.

PLAN STRUCTURE RULES:
- Provide a 7-day execution plan by default

IF–THEN EXECUTION RULES:
- Provide clear conditional rules the student must follow during the mock

CLARIFICATION LIMIT:
- Ask no more than TWO clarifying questions

OUTPUT REQUIREMENTS:
- Output VALID JSON only
- Must strictly match the provided schema
- No markdown, no commentary, no extra keys
`.trim();

/**
 * Build strategy USER payload (updated for new schema)
 */
function buildStrategyUserContent(params: {
  input: AnalyzeInput;
  report: any;
  strategyMeta?: StrategyMeta;
}) {
  const { input, report, strategyMeta } = params;

  const meta = strategyMeta || (report?.meta?.strategy as StrategyMeta | undefined);

  return `
INPUTS:
exam=${safeText(input.exam)}
intake=${safeText(input.intake)}
strategy_meta=${safeText(meta)}

REPORT (compact):
${safeText(
    {
      summary: report?.summary,
      primary_bottleneck: report?.primary_bottleneck,
      signal_quality: report?.signal_quality,
      confidence: report?.confidence,
      patterns: report?.patterns,
      next_actions: report?.next_actions,
      plan_days: report?.plan?.days?.length,
      next_mock_strategy: report?.next_mock_strategy,
    },
    2600
  )}

Return JSON only matching the schema.
`.trim();
}

function looksGeneric(s: string) {
  const x = (s || "").toLowerCase();
  const bad = [
    "practice more",
    "revise",
    "revision",
    "study more",
    "be confident",
    "focus more",
    "work harder",
    "improve concepts",
    "do more questions",
    "keep practicing",
  ];
  return bad.some((p) => x.includes(p));
}

function hasGenericAdvice(plan: StrategyPlan) {
  const blobs: string[] = [];
  blobs.push(plan.title);
  plan.top_levers.forEach((l) => {
    blobs.push(l.title, l.why, l.metric, l.next_mock_rule, ...l.do, ...l.stop);
  });
  blobs.push(...plan.if_then_rules);
  plan.plan_days.forEach((d) => blobs.push(d.title, ...d.tasks));
  plan.next_questions?.forEach((q) =>
    blobs.push(q.question, ...(q.options ?? []), ...(q.unlocks ?? []))
  );
  return blobs.some(looksGeneric);
}

/**
 * One retry max on generic-advice failure
 */
async function generateStrategyPlanOnce(params: {
  input: AnalyzeInput;
  report: any;
  strategyMeta?: StrategyMeta;
  retryNote?: string;
}) {
  const { input, report, strategyMeta, retryNote } = params;

  const baseUser = buildStrategyUserContent({ input, report, strategyMeta });
  const userContent = retryNote ? `${baseUser}\n\nRETRY_NOTE:\n${retryNote}` : baseUser;

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const sres = await client.responses.parse({
    model: STRATEGY_MODEL,
    input: [
      {
        role: "system",
        content:
          STRATEGY_MASTER_SYSTEM_PROMPT +
          "\n\nYou are Cogniverse Strategy Engine. Output only valid JSON matching the schema.",
      },
      { role: "user", content: userContent },
    ],
    text: {
      format: zodTextFormat(StrategyPlanSchema, "strategy_plan"),
    },
  });

  return sres.output_parsed ? (sres.output_parsed as StrategyPlan) : null;
}

export async function analyzeMock(input: AnalyzeInput): Promise<Report> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = buildPrompt(input);

  const response = await client.responses.parse({
    model: REPORT_MODEL,
    input: [
      {
        role: "system",
        content: "You are Cogniverse Mock Analyzer. Always follow the output schema strictly.",
      },
      { role: "user", content: prompt },
    ],
    text: {
      format: zodTextFormat(ReportSchema, "mock_report"),
    },
  });

  if (!response.output_parsed) {
    const raw = response.output_text?.slice(0, 800);
    throw new Error(`Model did not return parsed JSON. Raw: ${raw ?? "EMPTY"}`);
  }

  const report = response.output_parsed as any;
  report.meta = report.meta || {};

  // Strategy generation (BEST-EFFORT)
  try {
    const strategyMeta: StrategyMeta | undefined = report?.meta?.strategy;

    let retryUsed = false;

    let plan = await generateStrategyPlanOnce({ input, report, strategyMeta });

    if (plan && hasGenericAdvice(plan)) {
      retryUsed = true;
      const retry = await generateStrategyPlanOnce({
        input,
        report,
        strategyMeta,
        retryNote:
          "Your last output contained generic advice. Remove ALL generic phrases and ensure actions are decision-level and verifiable in the next mock.",
      });
      if (retry) plan = retry;
    }

    if (plan) {
      report.meta.strategy_plan = plan;
      report.meta.strategy_retry_used = retryUsed;
      report.meta.strategy_model = STRATEGY_MODEL;
      report.meta.report_model = REPORT_MODEL;
    } else {
      report.meta.strategy_plan_error =
        "Strategy plan parse returned empty output_parsed.";
    }
  } catch (e: any) {
    report.meta.strategy_plan_error = String(e?.message ?? e);
  }

  return report as Report;
}
