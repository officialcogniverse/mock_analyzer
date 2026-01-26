import { z } from "zod";

export const ExamOptionSchema = z.enum(["CAT", "JEE", "NEET", "UPSC", "OTHER"]);
export const MotivationBlockerSchema = z.enum([
  "LOW_MOTIVATION",
  "INCONSISTENT",
  "LOW_ACCURACY",
  "WEAK_CONCEPTS",
  "TIME_MANAGEMENT",
  "OTHER",
]);
export const RoutineTypeSchema = z.enum(["MORNING", "NIGHT", "MIXED"]);
export const WeeklyHoursRangeSchema = z.enum(["0_3", "4_6", "7_10", "11_15", "16_25", "25_PLUS"]);

export const IntakeAnswersSchema = z
  .object({
    exam: ExamOptionSchema.optional(),
    daysToExam: z.number().int().min(0).optional(),
    situation: MotivationBlockerSchema.optional(),
    weeklyHours: WeeklyHoursRangeSchema.optional(),
    routineType: RoutineTypeSchema.optional(),
    biggestPainPoint: z.string().trim().min(1).optional(),
  })
  .strict();

export const AnalyzeRequestSchema = z
  .object({
    intake: IntakeAnswersSchema.optional(),
    source: z.enum(["pdf", "text"]),
    text: z.string().trim().min(1),
    horizonDays: z.union([z.literal(7), z.literal(14)]).optional(),
  })
  .strict();

export const PrioritySchema = z.enum(["P0", "P1", "P2"]);
export const DataQualitySchema = z.enum(["low", "medium", "high"]);

export const TopErrorSchema = z
  .object({
    title: z.string().trim().min(1),
    whyItHappens: z.string().trim().min(1),
    fix: z.string().trim().min(1),
    severity: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
  })
  .strict();

export const NextBestActionSchema = z
  .object({
    title: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    timeMinutes: z.number().int().min(5),
    difficulty: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    priority: PrioritySchema,
    checklist: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export const PlanTaskSchema = z
  .object({
    title: z.string().trim().min(1),
    minutes: z.number().int().min(5),
    method: z.string().trim().min(1),
    expectedOutcome: z.string().trim().min(1),
  })
  .strict();

export const PlanDaySchema = z
  .object({
    day: z.number().int().min(1).max(14),
    focus: z.string().trim().min(1),
    tasks: z.array(PlanTaskSchema).min(1),
  })
  .strict();

export const StudyPlanSchema = z
  .object({
    horizonDays: z.union([z.literal(7), z.literal(14)]),
    days: z.array(PlanDaySchema).min(1),
  })
  .strict();

export const MotivationSchema = z
  .object({
    currentStateLabel: z.string().trim().min(1),
    microPepTalk: z.string().trim().min(1),
    routineAdvice: z.string().trim().min(1),
    environmentTweaks: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export const ConfidenceSchema = z
  .object({
    dataQuality: DataQualitySchema,
    missingInputs: z.array(z.string().trim().min(1)),
  })
  .strict();

export const AnalysisResultSchema = z
  .object({
    summary: z.string().trim().min(1),
    topErrors: z.array(TopErrorSchema).min(1),
    nextBestActions: z.array(NextBestActionSchema).min(1),
    plan: StudyPlanSchema,
    motivation: MotivationSchema,
    confidence: ConfidenceSchema,
  })
  .strict();

export const ChatModeSchema = z.enum(["BREAKDOWN", "STRATEGY", "MOTIVATION"]);

export const ChatRequestSchema = z
  .object({
    mode: ChatModeSchema,
    message: z.string().trim().min(1),
    intake: IntakeAnswersSchema.optional(),
    analysis: AnalysisResultSchema.optional(),
  })
  .strict();

export const ChatResponseSchema = z
  .object({
    mode: ChatModeSchema,
    reply: z.string().trim().min(1),
    suggestedChips: z.array(z.string().trim().min(1)).optional(),
    disclaimer: z.string().trim().min(1).optional(),
  })
  .strict();

export type IntakeAnswers = z.infer<typeof IntakeAnswersSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type ChatMode = z.infer<typeof ChatModeSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type TopError = z.infer<typeof TopErrorSchema>;
export type NextBestAction = z.infer<typeof NextBestActionSchema>;
export type PlanTask = z.infer<typeof PlanTaskSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type Motivation = z.infer<typeof MotivationSchema>;

type NormalizeOptions = {
  missingInputs?: string[];
  horizonDays?: 7 | 14;
};

const fallbackErrorTemplates: TopError[] = [
  {
    title: "Concept gaps across a few topics",
    whyItHappens: "You’re attempting questions before fully locking the core concept or formula.",
    fix: "Pick 2 weak topics and do targeted revision + 15 mixed questions per topic.",
    severity: 4,
  },
  {
    title: "Time pressure leading to rushed attempts",
    whyItHappens: "Pace drifts because checkpoints aren’t enforced during the mock.",
    fix: "Set a mid-section time checkpoint and skip after 2 missed steps.",
    severity: 3,
  },
  {
    title: "Careless errors in familiar areas",
    whyItHappens: "You’re overconfident on easy items and skip verification.",
    fix: "Add a 20-second verification pass for all easy questions.",
    severity: 2,
  },
];

const fallbackActions: NextBestAction[] = [
  {
    title: "Run a 30-minute error audit",
    reason: "Pinpoint 3 recurring mistake patterns before the next mock.",
    timeMinutes: 30,
    difficulty: 2,
    priority: "P0",
    checklist: ["List top 3 error types", "Write 1 fix per error", "Choose 1 drill for each fix"],
  },
  {
    title: "Accuracy reset drill",
    reason: "Build discipline by slowing down on easy questions.",
    timeMinutes: 25,
    difficulty: 2,
    priority: "P1",
    checklist: ["Attempt 15 easy questions", "Verify every answer", "Track careless slips"],
  },
  {
    title: "Topic revisit sprint",
    reason: "Close gaps on two weak concepts quickly.",
    timeMinutes: 40,
    difficulty: 3,
    priority: "P0",
    checklist: ["Pick two weak topics", "Review notes for 10 mins", "Solve 10 mixed questions"],
  },
  {
    title: "Timed mini-mock",
    reason: "Practice pacing without full-length fatigue.",
    timeMinutes: 35,
    difficulty: 3,
    priority: "P1",
    checklist: ["Pick 20 questions", "Set strict time", "Review 5 mistakes"],
  },
  {
    title: "Reflection + plan update",
    reason: "Lock lessons into your 7-day schedule.",
    timeMinutes: 15,
    difficulty: 1,
    priority: "P2",
    checklist: ["Write 3 learnings", "Update weekly focus", "Schedule next mock review"],
  },
];

const fallbackPlanTask: PlanTask = {
  title: "Targeted revision + practice set",
  minutes: 45,
  method: "Review notes, then solve 10-15 focused questions.",
  expectedOutcome: "Fewer mistakes in the weakest topic.",
};

const fallbackMotivation: Motivation = {
  currentStateLabel: "Reset and refocus",
  microPepTalk: "You’re not behind—you’re collecting data. One clean week can change your score curve.",
  routineAdvice: "Anchor study blocks to your most consistent energy window.",
  environmentTweaks: ["Keep a visible checklist", "Silence notifications during drills", "Use a timer"],
};

function ensureArrayLength<T>(items: T[], minLength: number, filler: (index: number) => T): T[] {
  const output = [...items];
  while (output.length < minLength) {
    output.push(filler(output.length));
  }
  return output;
}

function buildFallbackPlan(horizonDays: 7 | 14): StudyPlan {
  const days = Array.from({ length: horizonDays }).map((_, idx) => ({
    day: idx + 1,
    focus: idx % 2 === 0 ? "Concept repair + drills" : "Mixed practice + review",
    tasks: [
      fallbackPlanTask,
      {
        title: "Error log review",
        minutes: 20,
        method: "Review mistakes, identify pattern, note fix.",
        expectedOutcome: "Cleaner decision-making in similar questions.",
      },
    ],
  }));

  return {
    horizonDays,
    days,
  };
}

function normalizePlanDays(plan: StudyPlan, horizonDays: 7 | 14): StudyPlan {
  const days = plan.days
    .map((day, idx) => ({
      ...day,
      day: idx + 1,
      tasks: day.tasks.length ? day.tasks : [fallbackPlanTask],
    }))
    .slice(0, horizonDays);

  const filled = ensureArrayLength(days, horizonDays, (index) => ({
    day: index + 1,
    focus: "Concept repair + drills",
    tasks: [fallbackPlanTask],
  }));

  return {
    horizonDays,
    days: filled,
  };
}

function deriveMissingInputs(intake?: IntakeAnswers): string[] {
  if (!intake) {
    return ["exam", "daysToExam", "situation", "weeklyHours", "routineType", "biggestPainPoint"];
  }

  const missing: string[] = [];
  if (!intake.exam) missing.push("exam");
  if (intake.daysToExam === undefined) missing.push("daysToExam");
  if (!intake.situation) missing.push("situation");
  if (!intake.weeklyHours) missing.push("weeklyHours");
  if (!intake.routineType) missing.push("routineType");
  if (!intake.biggestPainPoint) missing.push("biggestPainPoint");
  return missing;
}

function issuesToMissingInputs(issues: z.ZodIssue[]): string[] {
  return issues
    .map((issue) => issue.path.filter((segment) => typeof segment === "string").join("."))
    .filter(Boolean);
}

export function normalizeAnalysisResult(raw: unknown, options: NormalizeOptions = {}): AnalysisResult {
  const parsed = AnalysisResultSchema.safeParse(raw);
  const horizonDays = options.horizonDays ?? 7;
  const missingFromIssues = parsed.success ? [] : issuesToMissingInputs(parsed.error.issues);
  const missingInputs = Array.from(
    new Set([...(options.missingInputs ?? []), ...missingFromIssues])
  );

  if (!parsed.success) {
    const fallbackPlan = buildFallbackPlan(horizonDays);
    return {
      summary:
        "We couldn’t fully parse your mock. Here’s a safe starter plan to stabilize accuracy and pace.",
      topErrors: fallbackErrorTemplates,
      nextBestActions: fallbackActions,
      plan: fallbackPlan,
      motivation: fallbackMotivation,
      confidence: {
        dataQuality: "low",
        missingInputs,
      },
    };
  }

  const base = parsed.data;
  const normalizedErrors = ensureArrayLength(base.topErrors, 3, (index) => {
    return fallbackErrorTemplates[index % fallbackErrorTemplates.length];
  });
  const normalizedActions = ensureArrayLength(base.nextBestActions, 5, (index) => {
    return fallbackActions[index % fallbackActions.length];
  }).map((action) => ({
    ...action,
    checklist: action.checklist.length ? action.checklist : ["Review notes", "Do 10 questions"],
  }));

  const plan = normalizePlanDays(base.plan, options.horizonDays ?? base.plan.horizonDays);
  const tweaks =
    base.motivation.environmentTweaks.length > 0
      ? base.motivation.environmentTweaks
      : fallbackMotivation.environmentTweaks;

  const confidenceMissing =
    missingInputs.length > 0 ? missingInputs : base.confidence.missingInputs ?? [];
  const dataQuality =
    confidenceMissing.length >= 3
      ? "low"
      : confidenceMissing.length > 0
        ? "medium"
        : base.confidence.dataQuality;

  return {
    ...base,
    topErrors: normalizedErrors,
    nextBestActions: normalizedActions,
    plan,
    motivation: {
      ...base.motivation,
      environmentTweaks: tweaks,
    },
    confidence: {
      dataQuality,
      missingInputs: confidenceMissing,
    },
  };
}

export function buildMissingInputs(intake?: IntakeAnswers): string[] {
  return deriveMissingInputs(intake);
}
