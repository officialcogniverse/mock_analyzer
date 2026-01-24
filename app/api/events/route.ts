import { NextResponse } from "next/server";
import { ensureUserId } from "@/lib/session";
import { fireAndForgetEvent } from "@/lib/events";
import { EventPayloadSchema } from "@/lib/schemas/event";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = ensureUserId(req);

    // ✅ route me request body aise parse karte hain
    const body = await req.json().catch(() => null);

    const parsed = EventPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
    }

    fireAndForgetEvent({ userId: session.userId, payload: parsed.data });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Event route failed" },
      { status: 500 }
    );
  }
}
