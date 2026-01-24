import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/session";
import { EventPayloadSchema, fireAndForgetEvent } from "@/lib/events";
import { readJsonSafely } from "@/lib/fetcher";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureUserId(req);
  const body = await readJsonSafely(req);
  const parsed = EventPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  fireAndForgetEvent({ userId: session.userId, payload: parsed.data });

  return NextResponse.json({ ok: true });
}
