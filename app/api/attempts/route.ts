import { NextResponse } from "next/server";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { listAttempts } from "@/lib/persist";
import { AttemptSchema } from "@/lib/domain/schemas";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Attempts are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || "20");
  const limit = Number.isFinite(limitParam) ? Math.min(50, Math.max(1, limitParam)) : 20;

  const rows = await listAttempts(session.userId, limit);
  const attempts = rows.map((row) =>
    AttemptSchema.parse({
      id: row.id,
      userId: session.userId,
      createdAt: new Date(row.createdAt).toISOString(),
      sourceType: "upload",
      metrics: [],
    })
  );

  const res = NextResponse.json({ attempts });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
