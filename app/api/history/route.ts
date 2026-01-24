import { NextResponse } from "next/server";
import { normalizeExam } from "@/lib/exams";
import { listAttempts, upsertUser } from "@/lib/persist";
import { attachSessionCookie, ensureSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = ensureSession(req);

  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "History is student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  try {
    await upsertUser(session.userId);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
    const exam = normalizeExam(url.searchParams.get("exam") || "");

    const rows = await listAttempts(session.userId, limit);

    const items = exam
      ? rows.filter((x: any) => String(x.exam || "").toUpperCase() === exam)
      : rows;

    const latestByExam: Record<string, string> = {};
    for (const it of rows) {
      const ex = normalizeExam(it?.exam);
      if (!ex) continue;
      if (!latestByExam[ex]) latestByExam[ex] = String(it.id);
    }

    const latestId = items?.[0]?.id || null;

    const res = NextResponse.json({
      items,
      meta: { latestId, latestByExam, limit, exam: exam ?? "ALL" },
    });

    if (session.isNew) attachSessionCookie(res, session);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message || "Failed to load history" },
      { status: 500 }
    );
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }
}
