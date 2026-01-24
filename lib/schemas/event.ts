import { z } from "zod";

export const EventNameSchema = z.enum([
  "upload_attempt",
  "analyze_attempt",
  "view_actions",
  "generate_plan",
  "mark_action_done",
  "create_note",
  "view_history",
  "chat_with_bot",
]);

export const EventPayloadSchema = z
  .object({
    eventName: EventNameSchema,
    payload: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export type EventName = z.infer<typeof EventNameSchema>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;
