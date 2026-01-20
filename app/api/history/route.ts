import { NextResponse } from "next/server";
import { EXAMS, normalizeExam, type Exam } from "@/lib/exams";
import { listAttempts, upsertUser } from "@/lib/persist";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";

export const runtime = "nodejs";

type ExamKey = Exam;

export async function GET(req: Request) {
  const session = ensureUserId(req);

  try {
    await upsertUser(session.userId);

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
    const exam = normalizeExam(url.searchParams.get("exam") || "");

    // listAttempts returns all exams; filter here (v1)
    const rows = await listAttempts(session.userId, limit);
    const rows3 = rows.filter((x: any) =>
      EXAMS.includes(String(x.exam || "").toUpperCase() as Exam)
    );


    const items = exam
      ? rows.filter((x: any) => String(x.exam || "").toUpperCase() === exam)
      : rows;

    // Useful meta for "Continue journey" per exam
    const latestByExam: Partial<Record<ExamKey, string>> = {};
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

    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message || "Failed to load history" },
      { status: 500 }
    );
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }
}
