import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { upsertUser } from "@/lib/persist";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureSession(req);

  await upsertUser(session.userId);

  const res = NextResponse.json({
    userId: session.userId,
    mode: session.mode,
    role: session.role,
    instituteId: session.instituteId ?? null,
    isNew: session.isNew,
  });

  if (session.isNew) {
    attachSessionCookie(res, session);
  }

  return res;
}
