import { z } from "zod";

export const EventPayloadSchema = z.object({
  name: z.string(),
  attemptId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.string().optional(),
});
