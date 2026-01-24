import { z } from "zod";
import { SessionModeSchema, SessionRoleSchema } from "@/lib/session";

export const UserSchema = z
  .object({
    id: z.string().min(6),
    email: z.string().email().optional(),
    mode: SessionModeSchema.default("student"),
    role: SessionRoleSchema.default("student"),
    instituteId: z.string().min(6).optional(),
  })
  .strict();

export const AttemptSchema = z
  .object({
    id: z.string().min(6),
    userId: z.string().min(6),
    exam: z.string().min(2),
    createdAt: z.string(),
    report: z.record(z.string(), z.any()),
  })
  .strict();

export const ActionStateSchema = z
  .object({
    actionId: z.string().min(2),
    title: z.string().min(2),
    status: z.enum(["pending", "completed"]),
    reflection: z.string().optional().default(""),
    completedAt: z.string().nullable().optional(),
  })
  .strict();

export const CoachModeSchema = z.enum([
  "explain_report",
  "focus_today",
  "score_not_improving",
  "next_mock_strategy",
  "am_i_improving",
]);

export const CoachCitationSchema = z
  .object({
    type: z.enum(["pattern", "action", "metric", "comparison"]),
    ref: z.string().min(1),
    label: z.string().min(1),
  })
  .strict();

export const CoachConversationSchema = z
  .object({
    conversationId: z.string().min(8),
    userId: z.string().min(6),
    attemptId: z.string().min(6),
    exam: z.string().min(2),
    linkedAttemptIds: z.array(z.string().min(6)).min(1),
    referencedPatterns: z.array(z.string().min(1)),
  })
  .strict();

export const CoachMessageSchema = z
  .object({
    role: z.enum(["user", "coach"]),
    mode: CoachModeSchema,
    content: z.string().min(1),
    citations: z.array(CoachCitationSchema).min(1),
    createdAt: z.string(),
  })
  .strict();

export const CoachRequestSchema = z
  .object({
    attemptId: z.string().min(6),
    mode: CoachModeSchema,
    message: z.string().min(2).max(2000).optional(),
    conversationId: z.string().min(8).optional(),
  })
  .strict();

export const CoachResponseSchema = z
  .object({
    conversation: CoachConversationSchema,
    messages: z.array(CoachMessageSchema).min(1),
    groundedIn: z.array(CoachCitationSchema).min(1),
  })
  .strict();

export const InstituteStudentSchema = z
  .object({
    userId: z.string().min(6),
    latestAttemptId: z.string().min(6),
    createdAt: z.string(),
    exam: z.string().min(2),
    scorePct: z.number().nullable(),
    confidence: z.string().min(2),
    primaryBottleneck: z.string().min(2),
    actionCompletionRate: z.number().min(0).max(100),
    riskFlag: z.enum(["stagnant", "watch", "improving"]),
  })
  .strict();

export const EventSchema = z
  .object({
    event_name: z.string().min(2),
    attempt_id: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export type CoachMode = z.infer<typeof CoachModeSchema>;
export type CoachCitation = z.infer<typeof CoachCitationSchema>;
