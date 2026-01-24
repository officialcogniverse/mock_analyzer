import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { fireAndForgetEvent } from "@/lib/events";
import { EventPayloadSchema } from "@/lib/schemas/event";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureSession(req);

  try {
    const body = await req.json().catch(() => null);
    const parsed = EventPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const res = NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
      if (session.isNew) attachSessionCookie(res, session);
      return res;
    }

    fireAndForgetEvent({ userId: session.userId, payload: parsed.data });

    const res = NextResponse.json({ ok: true });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  } catch (err: any) {
    const res = NextResponse.json(
      { error: err?.message || "Event route failed" },
      { status: 500 }
    );
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
}
