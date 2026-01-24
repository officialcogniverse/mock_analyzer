import { z } from "zod";

const isoDateString = z.string().min(10);

export const SessionUserSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullish(),
  createdAt: isoDateString.optional(),
});

export const AttemptMetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  evidence: z.string().optional(),
});

export const AttemptSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  createdAt: isoDateString,
  sourceType: z.enum(["upload", "text", "manual"]),
  rawText: z.string().optional(),
  metrics: z.array(AttemptMetricSchema).default([]),
});

export const ReportPatternSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  evidence: z.string().min(1),
  impact: z.string().min(1),
  fix: z.string().min(1),
});

export const ReportActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  duration: z.string().min(1),
  expectedImpact: z.string().min(1),
  steps: z.array(z.string()).default([]),
});

export const ReportPlanDaySchema = z.object({
  day: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
  focus: z.string().optional(),
  actions: z.array(z.string()).optional(),
});

export const ReportPlanSchema = z.object({
  days: z.array(ReportPlanDaySchema).default([]),
  levers: z.array(z.object({ title: z.string().optional(), detail: z.string().optional() })).default([]),
  rules: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

export const ReportConfidenceSchema = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string()).default([]),
  missingSignals: z.array(z.string()).default([]),
});

export const SignalQualitySchema = z.object({
  score: z.number().min(0).max(100),
  band: z.enum(["low", "medium", "high"]),
  missingSignals: z.array(z.string()).default([]),
});

export const ReportSchema = z.object({
  attemptId: z.string().min(1),
  userId: z.string().min(1),
  summary: z.string().min(1),
  patterns: z.array(ReportPatternSchema).default([]),
  nextActions: z.array(ReportActionSchema).default([]),
  strategy: z.object({
    nextMockScript: z.array(z.string()).default([]),
    attemptRules: z.array(z.string()).default([]),
  }),
  plan: ReportPlanSchema,
  confidence: ReportConfidenceSchema,
  signalQuality: SignalQualitySchema,
});

export const ActionStateSchema = z.object({
  userId: z.string().min(1),
  attemptId: z.string().min(1),
  actionId: z.string().min(1),
  status: z.enum(["pending", "completed", "skipped"]),
  updatedAt: isoDateString,
  reflection: z.string().optional(),
});

export const EventSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: isoDateString,
});

export const AttemptBundleSchema = z.object({
  attempt: AttemptSchema,
  report: ReportSchema,
});

export const AttemptDetailSchema = z.object({
  attempt: AttemptSchema,
  report: ReportSchema,
  actionState: z.array(ActionStateSchema).default([]),
  deltaFromPrevious: z
    .object({
      previousAttemptId: z.string().min(1),
      summary: z.string().min(1),
      changes: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type AttemptBundle = z.infer<typeof AttemptBundleSchema>;
export type AttemptDetail = z.infer<typeof AttemptDetailSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ActionState = z.infer<typeof ActionStateSchema>;
export type Event = z.infer<typeof EventSchema>;
