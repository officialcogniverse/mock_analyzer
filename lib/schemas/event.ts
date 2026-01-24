import { z } from "zod";
import { EventNameSchema } from "@/lib/events";

export const EventPayloadSchema = z
  .object({
    event_name: EventNameSchema,
    attempt_id: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();
