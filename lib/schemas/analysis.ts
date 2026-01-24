import { z } from "zod";

export const AnalysisSchema = z.object({
  userId: z.string().min(1),
  attemptId: z.string().min(1),
  uploadId: z.string().min(1),
  createdAt: z.string().datetime(),
  summary: z.string(),
  nba: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      reason: z.string(),
      score: z.number(),
    })
  ),
  plan: z.array(
    z.object({
      day: z.number(),
      title: z.string(),
      tasks: z.array(z.string()),
    })
  ),
  signalsUsed: z.record(z.string(), z.any()),
  warnings: z.array(z.string()).optional(),
});

export type AnalysisDoc = z.infer<typeof AnalysisSchema>;
