import { NextResponse } from "next/server";
import { z } from "zod";
import { createDefaultState, applyEventToState } from "@/lib/state/envelope";
import { getUserState, logEvent, saveUserState } from "@/lib/state/persistence";
import { normalizeEvent } from "@/lib/events/registry";
import { getOrCreateUserId } from "@/lib/state/user";

export const runtime = "nodejs";

const EventSchema = z.object({
  attemptId: z.string().min(1),
  event: z.object({
    type: z.string().min(1),
    ts: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
    context: z.record(z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

function toSnapshot(state: ReturnType<typeof createDefaultState>) {
  return {
    userId: state.userId,
    version: state.version,
    signals: state.signals ?? {},
    facts: state.facts ?? {},
    lastUpdated: state.updatedAt,
  };
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = EventSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_EVENT", message: "Invalid event payload." } },
      { status: 400 }
    );
  }

  const userId = await getOrCreateUserId();
  const isAuthed = !userId.startsWith("anon_");
  const state = isAuthed ? await getUserState(userId) : createDefaultState(userId);
  const event = normalizeEvent(userId, {
    ...parsed.data.event,
    context: {
      ...(parsed.data.event.context ?? {}),
      attemptId: parsed.data.attemptId,
    },
  });
  const nextState = applyEventToState(state, event);

  if (isAuthed) {
    await logEvent(event);
    await saveUserState(nextState);
  }

  return NextResponse.json({ stateSnapshot: toSnapshot(nextState) });
}
