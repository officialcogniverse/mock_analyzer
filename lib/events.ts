import { z } from "zod";
import { getDb } from "@/lib/mongo";

export const EventNameSchema = z.enum([
  "login_success",
  "attempt_uploaded",
  "report_generated",
  "coach_message_sent",
  "action_completed",
  "next_attempt_uploaded",
  // legacy UI events retained for backwards compatibility
  "ui_viewed_report",
  "ui_clicked_cta",
  "followup_answered",
  "export_clicked",
]);

export const EventPayloadSchema = z
  .object({
    event_name: EventNameSchema,
    attempt_id: z.string().min(1).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export type EventName = z.infer<typeof EventNameSchema>;
export type EventPayload = z.infer<typeof EventPayloadSchema>;

export type EventDoc = {
  _id?: unknown;
  event_name: EventName;
  user_id: string;
  attempt_id?: string;
  metadata: Record<string, any>;
  created_at: Date;
};

export async function writeEvent(params: { userId: string; payload: EventPayload }) {
  const db = await getDb();
  const col = db.collection<EventDoc>("events");

  const doc: EventDoc = {
    user_id: params.userId,
    event_name: params.payload.event_name,
    attempt_id: params.payload.attempt_id,
    metadata: params.payload.metadata ?? {},
    created_at: new Date(),
  };

  await col.insertOne(doc);
}

export function fireAndForgetEvent(params: { userId: string; payload: EventPayload }) {
  void writeEvent(params).catch((error) => {
    console.warn("Event write failed", {
      event: params.payload.event_name,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
