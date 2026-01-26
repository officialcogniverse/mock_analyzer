import { randomUUID } from "crypto";

export type EventInput = {
  type: string;
  ts?: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  requestId?: string;
};

export type EventRecord = EventInput & {
  eventId: string;
  userId: string;
  ts: string;
};

const nowIso = () => new Date().toISOString();

export function normalizeEvent(userId: string, input: EventInput): EventRecord {
  return {
    eventId: `evt_${randomUUID()}`,
    userId,
    type: input.type,
    ts: input.ts ?? nowIso(),
    payload: input.payload ?? {},
    context: input.context ?? {},
    requestId: input.requestId,
  };
}
