import { z } from "zod";

export const AnalyzeTextSchema = z.object({
  text: z.string().min(80, "Paste at least 80 characters of mock text.").max(20000),
});

export const KnownSectionSchema = z.object({
  name: z.string().min(1),
  score: z.number().optional(),
  accuracy: z.number().optional(),
});

export const NormalizedAttemptSchema = z.object({
  known: z.object({
    score: z.number().optional(),
    accuracy: z.number().optional(),
    sections: z.array(KnownSectionSchema).optional(),
  }),
  inferred: z.object({
    persona: z.string().optional(),
    riskPatterns: z.array(z.string()).optional(),
    confidenceGap: z.string().optional(),
  }),
  missing: z.array(z.string()),
  artifacts: z.object({
    extractionQuality: z.enum(["high", "medium", "low"]),
    notes: z.string().optional(),
  }),
});

export const InsightBundleSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  risks: z.array(z.string()),
  known: NormalizedAttemptSchema.shape.known,
  inferred: NormalizedAttemptSchema.shape.inferred,
  missing: z.array(z.string()),
});

export const NBAActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  why: z.string().min(1),
  expectedImpact: z.string().min(1),
  effortLevel: z.enum(["S", "M", "L"]),
  timeHorizon: z.enum(["Today", "ThisWeek", "Next14Days"]),
  successCriteria: z.array(z.string().min(1)),
  tags: z.array(z.string().min(1)),
});

export const PlanTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  linkedNbaId: z.string().optional(),
  estMinutes: z.number().optional(),
  status: z.enum(["todo", "done", "skipped", "difficult"]),
  note: z.string().optional(),
});

export const PlanDaySchema = z.object({
  dayIndex: z.number(),
  dateISO: z.string().optional(),
  title: z.string().min(1),
  tasks: z.array(PlanTaskSchema),
});

export const PlanSchema = z.object({
  horizonDays: z.union([z.literal(7), z.literal(14)]),
  days: z.array(PlanDaySchema),
});

export const RecommendationBundleSchema = z.object({
  insights: InsightBundleSchema,
  nbas: z.array(NBAActionSchema).min(1),
  plan: PlanSchema,
  strategy: z.object({
    id: z.string().min(1),
    exam: z.string().min(1),
    persona: z.string().min(1),
  }),
});

export const ProgressEventSchema = z.object({
  recommendationId: z.string().min(1),
  taskId: z.string().min(1),
  status: z.enum(["todo", "done", "skipped", "difficult"]),
  note: z.string().optional(),
});

export type NormalizedAttempt = z.infer<typeof NormalizedAttemptSchema>;
export type InsightBundle = z.infer<typeof InsightBundleSchema>;
export type NBAAction = z.infer<typeof NBAActionSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type RecommendationBundle = z.infer<typeof RecommendationBundleSchema>;
export type ProgressEventInput = z.infer<typeof ProgressEventSchema>;
