import { NextResponse } from "next/server";
import { z } from "zod";
import { attachSessionCookie, ensureSession } from "@/lib/session";

const ChatRequestSchema = z.object({
  message: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureSession(req);
  const payload = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(payload);

  if (!parsed.success) {
    const res = NextResponse.json({ error: "Invalid chat payload." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const response = [
    "Use the report as your action checklist: start with the top 3 NBAs, then follow the probes.",
    "If a probe feels unclear, rerun the mock with the next-mock strategy rules before adding new topics.",
    "Upload your next attempt after completing at least 2 actions to get a stronger plan.",
  ].join(" ");

  const res = NextResponse.json({ ok: true, reply: response });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
