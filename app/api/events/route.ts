import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/session";
import { saveEvent } from "@/lib/persist";
import { z } from "zod";

const eventSchema = z.object({
  event: z.enum([
    "attempt_uploaded",
    "report_generated",
    "followup_answered",
    "action_completed",
    "next_attempt_uploaded",
  ]),
  metadata: z.record(z.any()).optional(),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureUserId(req);
  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  await saveEvent({
    userId: session.userId,
    event: parsed.data.event,
    metadata: parsed.data.metadata,
  });

  return NextResponse.json({ ok: true });
}
