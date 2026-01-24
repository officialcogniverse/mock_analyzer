import { z } from "zod";

export const ActionCompletionSchema = z.object({
  userId: z.string().min(1),
  analysisId: z.string().min(1),
  actionId: z.string().min(1),
  done: z.boolean(),
  completedAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
});

export type ActionCompletionDoc = z.infer<typeof ActionCompletionSchema>;
