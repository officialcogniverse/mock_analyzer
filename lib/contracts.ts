import { z } from "zod";

const nowIso = () => new Date().toISOString();
const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req_${Math.random().toString(36).slice(2, 10)}`;

export const ErrorSchema = z
  .object({
    code: z.string().default("UNKNOWN"),
    message: z.string().default("Something went wrong."),
    action: z.string().optional(),
    details: z.unknown().optional(),
  })
  .strict();

export const ErrorOrNullSchema = z.union([ErrorSchema, z.null()]);

export const NextBestActionInstructionSchema = z
  .object({
    when: z.string().default("Next study block"),
    what: z.string().default("Review notes and do a focused drill."),
    durationMin: z.number().int().min(1).default(25),
    stoppingCondition: z.string().default("Stop after the drill is complete."),
    successCriteria: z.string().default("You can explain the concept without notes."),
    materials: z.array(z.string()).default([]),
    commonMistakeToAvoid: z.string().optional(),
  })
  .strict();

export const NextBestActionSchema = z
  .object({
    id: z.string().default("action-1"),
    title: z.string().default("Quick accuracy reset"),
    category: z.enum(["academic", "execution", "confidence"]).default("execution"),
    why: z.string().default("Build momentum with a clean, focused practice block."),
    instructions: NextBestActionInstructionSchema.default({
      when: "Next study block",
      what: "Review notes and do a focused drill.",
      durationMin: 25,
      stoppingCondition: "Stop after the drill is complete.",
      successCriteria: "You can explain the concept without notes.",
      materials: [],
    }),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    estimatedImpact: z.enum(["low", "medium", "high"]).default("medium"),
  })
  .strict();

export const PlanStepSchema = z
  .object({
    id: z.string().default("step-1"),
    title: z.string().default("Focused drill"),
    timeboxMin: z.number().int().min(1).default(30),
    instructions: z.string().default("Complete the drill with full attention."),
    successCriteria: z.string().default("You finish within the timebox."),
    linkToActionId: z.string().optional(),
  })
  .strict();

export const PlanDaySchema = z
  .object({
    day: z.number().int().min(1).default(1),
    theme: z.string().default("Accuracy + pacing"),
    steps: z.array(PlanStepSchema).default([]),
    totalMin: z.number().int().min(0).default(0),
    confidenceNote: z.string().default("Keep it calm and repeatable."),
  })
  .strict();

export const ExecutionPlanSchema = z
  .object({
    horizonDays: z.union([z.literal(7), z.literal(14)]).default(7),
    days: z.array(PlanDaySchema).default([]),
  })
  .strict();

export const StateSnapshotSchema = z
  .object({
    userId: z.string().default("anonymous"),
    version: z.number().int().min(1).default(1),
    signals: z.record(z.unknown()).default({}),
    facts: z.record(z.unknown()).default({}),
    lastUpdated: z.string().default(nowIso),
  })
  .strict();

export const AnalyzeResponseSchema = z
  .object({
    ok: z.boolean().default(false),
    error: ErrorOrNullSchema.default(null),
    meta: z
      .object({
        exam: z.string().default("Unknown"),
        source: z.enum(["pdf", "text"]).default("text"),
        scannedPdf: z.boolean().default(false),
        extractedChars: z.number().int().min(0).default(0),
        requestId: z.string().default(randomId),
        timestamp: z.string().default(nowIso),
      })
      .default({
        exam: "Unknown",
        source: "text",
        scannedPdf: false,
        extractedChars: 0,
        requestId: randomId(),
        timestamp: nowIso(),
      }),
    nextBestActions: z.array(NextBestActionSchema).default([]),
    executionPlan: ExecutionPlanSchema.default({ horizonDays: 7, days: [] }),
    stateSnapshot: StateSnapshotSchema.default({
      userId: "anonymous",
      version: 1,
      signals: {},
      facts: {},
      lastUpdated: nowIso(),
    }),
    warnings: z.array(z.string()).default([]),
  })
  .strict();

export const BotDirectiveSchema = z.union([
  z.object({ type: z.literal("suggest_action"), actionId: z.string() }),
  z.object({ type: z.literal("regenerate_plan"), reason: z.string() }),
  z.object({ type: z.literal("note"), text: z.string() }),
  z.object({
    type: z.literal("ask_intake"),
    fields: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(["text", "number", "select"]),
        options: z.array(z.string()).optional(),
      })
    ),
  }),
  z.object({ type: z.literal("log_feedback"), key: z.string(), value: z.unknown() }),
]);

export const BotResponseSchema = z
  .object({
    ok: z.boolean().default(false),
    message: z.string().default("I’m here with you. Share what feels most urgent."),
    directives: z.array(BotDirectiveSchema).default([]),
    stateSnapshot: StateSnapshotSchema.default({
      userId: "anonymous",
      version: 1,
      signals: {},
      facts: {},
      lastUpdated: nowIso(),
    }),
    error: ErrorOrNullSchema.default(null),
  })
  .strict();

export const EventResponseSchema = z
  .object({
    ok: z.boolean().default(false),
    error: ErrorOrNullSchema.default(null),
    stateSnapshot: StateSnapshotSchema.default({
      userId: "anonymous",
      version: 1,
      signals: {},
      facts: {},
      lastUpdated: nowIso(),
    }),
  })
  .strict();

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type BotResponse = z.infer<typeof BotResponseSchema>;
export type EventResponse = z.infer<typeof EventResponseSchema>;
export type NextBestAction = z.infer<typeof NextBestActionSchema>;
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;
export type StateSnapshot = z.infer<typeof StateSnapshotSchema>;
export type BotDirective = z.infer<typeof BotDirectiveSchema>;

export function normalizeNulls<T>(value: T): T {
  if (value === null) {
    return undefined as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNulls(item)) as T;
  }
  if (typeof value === "object" && value) {
    const entries = Object.entries(value).map(([key, val]) => [key, normalizeNulls(val)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

export function safeParseOrDefault<T>(schema: z.ZodSchema<T>, data: unknown, fallback: T): T {
  const parsed = schema.safeParse(normalizeNulls(data));
  return parsed.success ? parsed.data : fallback;
}

export function createDefaultExecutionPlan(horizonDays: 7 | 14 = 7): ExecutionPlan {
  return {
    horizonDays,
    days: Array.from({ length: horizonDays }, (_, idx) => ({
      day: idx + 1,
      theme: "Calm accuracy + review",
      steps: [],
      totalMin: 0,
      confidenceNote: "Keep the pace gentle and repeatable.",
    })),
  };
}

export function createDefaultAnalyzeResponse(params: {
  source?: "pdf" | "text";
  scannedPdf?: boolean;
  extractedChars?: number;
  requestId?: string;
  stateSnapshot?: StateSnapshot;
  horizonDays?: 7 | 14;
} = {}): AnalyzeResponse {
  const requestId = params.requestId ?? randomId();
  const horizonDays = params.horizonDays ?? 7;
  return {
    ok: false,
    error: null,
    meta: {
      exam: "Unknown",
      source: params.source ?? "text",
      scannedPdf: params.scannedPdf ?? false,
      extractedChars: params.extractedChars ?? 0,
      requestId,
      timestamp: nowIso(),
    },
    nextBestActions: [],
    executionPlan: createDefaultExecutionPlan(horizonDays),
    stateSnapshot:
      params.stateSnapshot ??
      StateSnapshotSchema.parse({
        userId: "anonymous",
        version: 1,
        signals: {},
        facts: {},
        lastUpdated: nowIso(),
      }),
    warnings: [],
  };
}

export function createDefaultBotResponse(stateSnapshot?: StateSnapshot): BotResponse {
  return {
    ok: false,
    message: "I’m here with you. Share what feels most urgent.",
    directives: [],
    stateSnapshot:
      stateSnapshot ??
      StateSnapshotSchema.parse({
        userId: "anonymous",
        version: 1,
        signals: {},
        facts: {},
        lastUpdated: nowIso(),
      }),
    error: null,
  };
}

export function createDefaultEventResponse(stateSnapshot?: StateSnapshot): EventResponse {
  return {
    ok: false,
    error: null,
    stateSnapshot:
      stateSnapshot ??
      StateSnapshotSchema.parse({
        userId: "anonymous",
        version: 1,
        signals: {},
        facts: {},
        lastUpdated: nowIso(),
      }),
  };
}
