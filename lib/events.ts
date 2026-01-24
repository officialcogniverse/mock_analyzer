import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS } from "@/lib/db";
import type { EventPayload, EventName } from "@/lib/schemas/event";

export type EventDoc = {
  _id?: ObjectId;
  userId: string;
  eventName: EventName;
  payload?: Record<string, any>;
  timestamp: Date;
};

export async function writeEvent(params: { userId: string; payload: EventPayload }) {
  const db = await getDb();
  const col = db.collection<EventDoc>(COLLECTIONS.events);

  const doc: EventDoc = {
    userId: params.userId,
    eventName: params.payload.eventName,
    payload: params.payload.payload ?? {},
    timestamp: new Date(),
  };

  await col.insertOne(doc);
}

export function fireAndForgetEvent(params: { userId: string; payload: EventPayload }) {
  void writeEvent(params).catch((error) => {
    console.warn("Event write failed", {
      event: params.payload.eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
