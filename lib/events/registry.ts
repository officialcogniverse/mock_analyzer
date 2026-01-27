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
  const payload = input.payload ?? {};
  const sanitizedPayload = sanitizePayload(input.type, payload);
  return {
    eventId: `evt_${randomUUID()}`,
    userId,
    type: input.type,
    ts: input.ts ?? nowIso(),
    payload: sanitizedPayload,
    context: input.context ?? {},
    requestId: input.requestId,
  };
}

const confidenceOptions = new Set(["low", "med", "high"]);
const statusOptions = new Set(["attempted", "skipped"]);
const correctnessOptions = new Set(["correct", "incorrect", "unknown"]);
const errorTypeOptions = new Set(["concept", "time", "careless", "selection", "unknown"]);

function coerceNumber(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizePayload(type: string, payload: Record<string, unknown>) {
  if (type === "instrument_question_updated") {
    const sectionIndex = coerceNumber(payload.sectionIndex, 0);
    const questionIndex = coerceNumber(payload.questionIndex, 0);
    const confidence = confidenceOptions.has(String(payload.confidence))
      ? String(payload.confidence)
      : "med";
    const status = statusOptions.has(String(payload.status)) ? String(payload.status) : "attempted";
    const correctness = correctnessOptions.has(String(payload.correctness))
      ? String(payload.correctness)
      : "unknown";
    const errorType = errorTypeOptions.has(String(payload.errorType))
      ? String(payload.errorType)
      : "unknown";
    return {
      ...payload,
      sectionIndex,
      questionIndex,
      status,
      confidence,
      correctness,
      errorType,
      timeSpentSec: Math.max(0, coerceNumber(payload.timeSpentSec, 0)),
      updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : nowIso(),
      questionKey:
        typeof payload.questionKey === "string"
          ? payload.questionKey
          : `${sectionIndex}:${questionIndex}`,
    };
  }

  if (type.startsWith("plan_step_")) {
    return {
      ...payload,
      stepId: typeof payload.stepId === "string" ? payload.stepId : "",
    };
  }

  return payload;
}
