import { NextResponse } from "next/server";
import { z } from "zod";
import { createDefaultEventResponse, EventResponseSchema } from "@/lib/contracts";
import { normalizeEvent } from "@/lib/events/registry";
import { getOrCreateUserId } from "@/lib/state/user";
import { applyEventToState } from "@/lib/state/envelope";
import { getUserState, logEvent, saveUserState } from "@/lib/state/persistence";

export const runtime = "nodejs";

const EventRequestSchema = z
  .object({
    type: z.string().min(1),
    ts: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    context: z.record(z.unknown()).optional(),
    requestId: z.string().optional(),
  })
  .strict();

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = EventRequestSchema.safeParse(payload);

  const userId = await getOrCreateUserId();
  const state = await getUserState(userId);
  const fallback = createDefaultEventResponse({
    userId: state.userId,
    version: state.version,
    signals: state.signals,
    facts: state.facts,
    lastUpdated: state.updatedAt,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ...fallback, ok: false, error: { code: "INVALID_EVENT", message: "Invalid event payload." } },
      { status: 400 }
    );
  }

  const event = normalizeEvent(userId, parsed.data);
  const nextState = applyEventToState(state, event);
  await logEvent(event);
  await saveUserState(nextState);

  const response = EventResponseSchema.parse({
    ok: true,
    error: null,
    stateSnapshot: {
      userId: nextState.userId,
      version: nextState.version,
      signals: nextState.signals,
      facts: nextState.facts,
      lastUpdated: nextState.updatedAt,
    },
  });

  return NextResponse.json(response);
}
