import { z } from "zod";

export const AttemptSchema = z.object({
  userId: z.string().min(1),
  uploadId: z.string().min(1),
  createdAt: z.string().datetime(),
  exam: z.string().nullable().optional(),
  rawTextHash: z.string().nullable().optional(),
});

export type AttemptDoc = z.infer<typeof AttemptSchema>;
