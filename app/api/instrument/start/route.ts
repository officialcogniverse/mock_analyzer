import { NextResponse } from "next/server";
import { z } from "zod";
import { createDefaultState, applyEventToState } from "@/lib/state/envelope";
import { getUserState, logEvent, saveUserState } from "@/lib/state/persistence";
import { normalizeEvent } from "@/lib/events/registry";
import { getOrCreateUserId } from "@/lib/state/user";
import type { InstrumentTemplate } from "@/lib/instrument/types";

export const runtime = "nodejs";

const TemplateSchema = z.object({
  sectionCount: z.coerce.number().int().min(1).max(6).default(1),
  questionsPerSection: z.coerce.number().int().min(1).max(120).default(20),
  totalTimeMin: z.coerce.number().int().min(1).max(300).default(60),
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
  const parsed = TemplateSchema.safeParse(payload?.template ?? payload);
  const template: InstrumentTemplate = parsed.success
    ? parsed.data
    : { sectionCount: 1, questionsPerSection: 20, totalTimeMin: 60 };

  const userId = await getOrCreateUserId();
  const isAuthed = !userId.startsWith("anon_");
  const attemptId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `attempt_${Math.random().toString(36).slice(2, 10)}`;

  const state = isAuthed ? await getUserState(userId) : createDefaultState(userId);
  const event = normalizeEvent(userId, {
    type: "instrument_started",
    payload: { attemptId, template },
  });
  const nextState = applyEventToState(state, event);

  if (isAuthed) {
    await logEvent(event);
    await saveUserState(nextState);
  }

  return NextResponse.json({
    attemptId,
    stateSnapshot: toSnapshot(nextState),
  });
}
