import { callOpenAiChat } from "@/lib/ai/openai";
import { AnalysisSchema, type Analysis, type AnalysisErrorType } from "@/lib/schemas/mvp";

const ANALYSIS_SYSTEM_PROMPT = `You are an expert exam coach. Analyze the student's mock scorecard text and produce actionable guidance.
Return ONLY valid JSON matching this exact shape:
{
  "summary": "string",
  "errors": [{ "type": "concept|time|careless|selection|unknown", "detail": "string", "severity": 1|2|3 }],
  "nextBestActions": [{ "title": "string", "why": "string", "steps": ["string"], "etaMins": number }],
  "plan7d": [{ "day": 1, "focus": "string", "tasks": [{ "title": "string", "minutes": number, "done": false }] }]
}
Rules:
- Keep summary short (1-2 sentences).
- Provide 3-6 errors and 5-8 nextBestActions.
- Provide 7 days in plan7d.
- No markdown, no code fences, JSON only.`;

const VALID_ERROR_TYPES: AnalysisErrorType[] = ["concept", "time", "careless", "selection", "unknown"];

function extractJsonPayload(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}

function isValidErrorType(value: unknown): value is AnalysisErrorType {
  return VALID_ERROR_TYPES.includes(value as AnalysisErrorType);
}

function normalizeSteps(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((step) => (typeof step === "string" ? step : String(step ?? ""))).filter(Boolean);
}

function normalizeTasks(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.map((task) => ({
    title: typeof task?.title === "string" ? task.title : "Focused practice block",
    minutes: typeof task?.minutes === "number" && Number.isFinite(task.minutes) ? Math.max(0, task.minutes) : 30,
    done: typeof task?.done === "boolean" ? task.done : false,
  }));
}

function normalizeAnalysis(input: unknown): Analysis {
  const data = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  const errorsRaw = Array.isArray(data.errors) ? data.errors : [];
  const nextBestRaw = Array.isArray(data.nextBestActions) ? data.nextBestActions : [];
  const planRaw = Array.isArray(data.plan7d) ? data.plan7d : [];

  const errors = errorsRaw.map((err) => ({
    type: isValidErrorType(err?.type) ? err.type : "unknown",
    detail: typeof err?.detail === "string" ? err.detail : "",
    severity:
      err?.severity === 1 || err?.severity === 2 || err?.severity === 3
        ? err.severity
        : 2,
  }));

  const nextBestActions = nextBestRaw.map((action) => ({
    title: typeof action?.title === "string" ? action.title : "Focus on one improvement",
    why: typeof action?.why === "string" ? action.why : "This targets your biggest score leakage.",
    steps: normalizeSteps(action?.steps),
    etaMins:
      typeof action?.etaMins === "number" && Number.isFinite(action.etaMins)
        ? Math.max(0, Math.round(action.etaMins))
        : 30,
  }));

  const plan7d = planRaw.map((day, idx) => ({
    day:
      typeof day?.day === "number" && Number.isFinite(day.day)
        ? Math.min(7, Math.max(1, Math.round(day.day)))
        : idx + 1,
    focus: typeof day?.focus === "string" ? day.focus : "Targeted improvement",
    tasks: normalizeTasks(day?.tasks),
  }));

  const normalized = {
    summary: typeof data.summary === "string" ? data.summary : "",
    errors,
    nextBestActions,
    plan7d,
  };

  return AnalysisSchema.parse(normalized);
}

function buildFallbackAnalysis(text: string, reason?: string): Analysis {
  const lower = text.toLowerCase();
  const errorTypes: AnalysisErrorType[] = [];
  if (lower.includes("time") || lower.includes("slow") || lower.includes("speed")) errorTypes.push("time");
  if (lower.includes("careless") || lower.includes("silly") || lower.includes("mistake")) errorTypes.push("careless");
  if (lower.includes("guess") || lower.includes("selection") || lower.includes("attempt"))
    errorTypes.push("selection");
  if (lower.includes("concept") || lower.includes("theory") || lower.includes("formula")) errorTypes.push("concept");
  if (errorTypes.length === 0) errorTypes.push("concept", "time", "careless");

  const errors = errorTypes.slice(0, 4).map((type, idx) => ({
    type,
    detail:
      type === "time"
        ? "Pace drops in later sections; timing checkpoints are missing."
        : type === "careless"
          ? "Errors show up on easy questions; double-checking is inconsistent."
          : type === "selection"
            ? "Too many risky picks early; accuracy dips when guessing."
            : "Some core concepts need targeted revision and drilling.",
    severity: idx === 0 ? 3 : 2,
  }));

  const nextBestActions = [
    {
      title: "Build a 2-checkpoint timing plan",
      why: "You need a pacing guardrail to avoid end-section rushes.",
      steps: ["Set target time for midpoint", "Set target time for last 10 mins", "Review timing after mock"],
      etaMins: 20,
    },
    {
      title: "Create a 20-question accuracy drill",
      why: "Careless errors drop fast with repeated accuracy reps.",
      steps: ["Pick mixed difficulty", "Solve untimed with 2-step verification", "Log errors"],
      etaMins: 40,
    },
    {
      title: "Daily concept refresh",
      why: "Short concept rebuilds stabilize score swings.",
      steps: ["Pick 2 weak topics", "Summarize formulas/steps", "Solve 5 targeted questions"],
      etaMins: 35,
    },
    {
      title: "Smart question selection rule",
      why: "Skipping risky questions protects accuracy and time.",
      steps: ["Flag hard questions", "Skip if >90s stuck", "Return after buffer"],
      etaMins: 15,
    },
    {
      title: "Error log + fix loop",
      why: "Repeating fixes turns mistakes into points.",
      steps: ["Write why the error happened", "Note the fix", "Redo after 48h"],
      etaMins: 25,
    },
  ];

  const focusMap: Record<AnalysisErrorType, string> = {
    concept: "Concept rebuild",
    time: "Time control",
    careless: "Accuracy lock-in",
    selection: "Question selection",
    unknown: "Consistency",
  };

  const plan7d = Array.from({ length: 7 }, (_, idx) => {
    const type = errorTypes[idx % errorTypes.length] ?? "concept";
    return {
      day: idx + 1,
      focus: focusMap[type],
      tasks: [
        {
          title: "Targeted drill set",
          minutes: 35,
          done: false,
        },
        {
          title: "Review mistakes + write 1 fix",
          minutes: 20,
          done: false,
        },
        {
          title: "Mini timed set (10 Q)",
          minutes: 25,
          done: false,
        },
      ],
    };
  });

  const summary = reason
    ? `Fallback analysis used (${reason}). Focus on timing, accuracy, and concept cleanup this week.`
    : "Quick scan complete. Focus on timing, accuracy, and concept cleanup this week.";

  return AnalysisSchema.parse({
    summary,
    errors,
    nextBestActions,
    plan7d,
  });
}

export async function analyzeMockText(rawText: string): Promise<Analysis> {
  try {
    const response = await callOpenAiChat(
      [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Mock scorecard text:\n"""\n${rawText}\n"""`,
        },
      ],
      { temperature: 0.2, maxTokens: 900 }
    );

    const jsonPayload = extractJsonPayload(response);
    const parsed = JSON.parse(jsonPayload) as unknown;
    const normalized = normalizeAnalysis(parsed);

    if (!normalized.errors.length || !normalized.nextBestActions.length || normalized.plan7d.length < 7) {
      return buildFallbackAnalysis(rawText, "model_output_incomplete");
    }

    return normalized;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "analysis_failed";
    return buildFallbackAnalysis(rawText, reason);
  }
}
