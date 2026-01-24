import { z } from "zod";

export const NoteSchema = z.object({
  userId: z.string().min(1),
  analysisId: z.string().min(1),
  actionId: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type NoteDoc = z.infer<typeof NoteSchema>;
