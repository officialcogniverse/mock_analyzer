import { z } from "zod";

const isoDateString = z.string().min(10);

export const SessionUserSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullish(),
  createdAt: isoDateString.optional(),
});

export const StudentProfileSchema = z.object({
  displayName: z.string().min(1).catch("Student"),
  targetExamLabel: z.string().nullish(),
  goal: z.enum(["score", "accuracy", "speed", "concepts"]).catch("score"),
  nextMockDate: z.string().nullish(),
  dailyStudyMinutes: z.number().int().min(15).max(300).catch(60),
  biggestStruggle: z.string().nullish(),
  timezone: z.string().min(2).catch("Asia/Kolkata"),
});

export const AttemptMetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  evidence: z.string().optional(),
});

export const AttemptSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  userId: z.string().min(1).optional(),
  created_at: isoDateString,
  createdAt: isoDateString.optional(),
  source_type: z.enum(["upload", "text", "manual"]),
  sourceType: z.enum(["upload", "text", "manual"]).optional(),
  raw_text: z.string().optional(),
  rawText: z.string().optional(),
  metrics: z.array(AttemptMetricSchema).default([]),
  exam: z.string().min(2).default("GENERIC"),
});

export const ReportPatternSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  evidence: z.string().min(1),
  impact: z.string().min(1),
  fix: z.string().min(1),
  severity: z.number().int().min(1).max(5).catch(3),
});

export const ReportActionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  why: z.string().min(1),
  duration_min: z.number().int().min(5).max(240).catch(25),
  duration: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).catch(3),
  steps: z.array(z.string()).default([]),
  success_metric: z.string().min(1),
  expectedImpact: z.string().optional(),
});

export const ReportPlanTaskSchema = z.object({
  action_id: z.string().min(1).optional(),
  actionId: z.string().min(1).optional(),
  title: z.string().min(1),
  duration_min: z.number().int().min(5).max(240).catch(25),
  durationMin: z.number().int().min(5).max(240).optional(),
  note: z.string().optional(),
});

export const ReportPlanDaySchema = z.object({
  day_index: z.number().int().min(1),
  dayIndex: z.number().int().min(1).optional(),
  label: z.string().min(1),
  focus: z.string().min(1),
  tasks: z.array(ReportPlanTaskSchema).default([]),
});

export const ReportPlanSchema = z.object({
  days: z.array(ReportPlanDaySchema).default([]),
});

export const ReportProbeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  duration_min: z.number().int().min(5).max(180).catch(20),
  durationMin: z.number().int().min(5).max(180).optional(),
  instructions: z.string().min(1),
  success_check: z.string().min(1),
});

export const NextMockStrategySchema = z.object({
  rules: z.array(z.string()).default([]),
  time_checkpoints: z.array(z.string()).default([]),
  timeCheckpoints: z.array(z.string()).optional(),
  skip_policy: z.array(z.string()).default([]),
  skipPolicy: z.array(z.string()).optional(),
});

export const OverallExamStrategySchema = z.object({
  weekly_rhythm: z.array(z.string()).default([]),
  weeklyRhythm: z.array(z.string()).optional(),
  revision_loop: z.array(z.string()).default([]),
  revisionLoop: z.array(z.string()).optional(),
  mock_schedule: z.array(z.string()).default([]),
  mockSchedule: z.array(z.string()).optional(),
});

export const ReportFollowupSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(4),
  type: z.enum(["single", "text"]),
  options: z.array(z.string()).optional(),
});

export const ReportSchema = z.object({
  report_id: z.string().min(1),
  reportId: z.string().min(1).optional(),
  user_id: z.string().min(1),
  userId: z.string().min(1).optional(),
  attempt_id: z.string().min(1),
  attemptId: z.string().min(1).optional(),
  created_at: isoDateString,
  createdAt: isoDateString.optional(),
  signal_quality: z.enum(["low", "medium", "high"]),
  signalQuality: z.enum(["low", "medium", "high"]).optional(),
  confidence: z.number().min(0).max(100),
  primary_bottleneck: z.string().min(1),
  primaryBottleneck: z.string().min(1).optional(),
  summary: z.string().min(1),
  patterns: z.array(ReportPatternSchema).default([]),
  next_actions: z.array(ReportActionSchema).default([]),
  nextActions: z.array(ReportActionSchema).optional(),
  plan: ReportPlanSchema,
  probes: z.array(ReportProbeSchema).default([]),
  next_mock_strategy: NextMockStrategySchema,
  nextMockStrategy: NextMockStrategySchema.optional(),
  overall_exam_strategy: OverallExamStrategySchema,
  overallExamStrategy: OverallExamStrategySchema.optional(),
  followups: z.array(ReportFollowupSchema).default([]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const ActionStateSchema = z.object({
  user_id: z.string().min(1),
  userId: z.string().min(1).optional(),
  attempt_id: z.string().min(1),
  attemptId: z.string().min(1).optional(),
  action_id: z.string().min(1),
  actionId: z.string().min(1).optional(),
  status: z.enum(["pending", "completed", "skipped"]),
  updated_at: isoDateString,
  updatedAt: isoDateString.optional(),
  reflection: z.string().optional(),
});

export const EventSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: isoDateString,
});

export const AttemptBundleSchema = z.object({
  attempt: AttemptSchema,
  report: ReportSchema,
  profile: StudentProfileSchema.nullable().optional(),
});

export const AttemptDetailSchema = z.object({
  attempt: AttemptSchema,
  report: ReportSchema,
  profile: StudentProfileSchema.nullable().optional(),
  action_state: z.array(ActionStateSchema).default([]),
  actionState: z.array(ActionStateSchema).optional(),
  delta_from_previous: z
    .object({
      previous_attempt_id: z.string().min(1),
      previousAttemptId: z.string().min(1).optional(),
      summary: z.string().min(1),
      changes: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
  deltaFromPrevious: z
    .object({
      previous_attempt_id: z.string().min(1),
      summary: z.string().min(1),
      changes: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
export type StudentProfile = z.infer<typeof StudentProfileSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type AttemptBundle = z.infer<typeof AttemptBundleSchema>;
export type AttemptDetail = z.infer<typeof AttemptDetailSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type ReportAction = z.infer<typeof ReportActionSchema>;
export type ReportPattern = z.infer<typeof ReportPatternSchema>;
export type ReportPlanTask = z.infer<typeof ReportPlanTaskSchema>;
export type ReportFollowup = z.infer<typeof ReportFollowupSchema>;
export type ActionState = z.infer<typeof ActionStateSchema>;
export type Event = z.infer<typeof EventSchema>;
