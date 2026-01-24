import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { listAttemptsForInsights } from "@/lib/persist";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Attempts are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const url = new URL(req.url);
  const exam = String(url.searchParams.get("exam") || "").trim() || null;
  const limit = Math.max(3, Math.min(24, Number(url.searchParams.get("limit") || 12)));

  const attempts = await listAttemptsForInsights(session.userId, exam, limit);

  const res = NextResponse.json({ attempts });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
