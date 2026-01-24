import { NextResponse } from "next/server";
import { ensureSession, attachSessionCookie } from "@/lib/session";
import { getDb } from "@/lib/mongo";
import { getActionSummaryForAttempt } from "@/lib/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "institute" || !session.instituteId) {
    const res = NextResponse.json({ error: "Institute session required." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 400);

  const db = await getDb();
  const attemptsCol = db.collection<any>("mock_attempts");
  const rosterCol = db.collection<any>("institute_roster");

  const rosterRows = await rosterCol.find({ instituteId: session.instituteId }).toArray();
  const rosterUserIds = rosterRows
    .map((row) => String(row.studentUserId || "").trim())
    .filter(Boolean);

  const attemptQuery: any = rosterUserIds.length ? { userId: { $in: rosterUserIds } } : {};

  const attempts = await attemptsCol
    .find(attemptQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .project({ userId: 1, createdAt: 1, exam: 1, report: 1 })
    .toArray();

  const latestByUser = new Map<string, any>();
  attempts.forEach((attempt) => {
    const uid = String(attempt.userId || "");
    if (!uid || latestByUser.has(uid)) return;
    latestByUser.set(uid, attempt);
  });

  const students = await Promise.all(
    Array.from(latestByUser.values()).map(async (attempt) => {
      const patterns = Array.isArray(attempt.report?.patterns) ? attempt.report.patterns : [];
      const actions = Array.isArray(attempt.report?.next_actions) ? attempt.report.next_actions : [];
      const attemptId = attempt._id?.toString?.() || "";
      const adherence = attemptId ? await getActionSummaryForAttempt(attemptId) : null;

      const completionRate = adherence?.completionRate ?? 0;
      const scoreValue = Number(attempt.report?.estimated_score?.value);
      const scoreMax = Number(attempt.report?.estimated_score?.max);
      const scorePct =
        Number.isFinite(scoreValue) && Number.isFinite(scoreMax) && scoreMax > 0
          ? Math.round((scoreValue / scoreMax) * 100)
          : null;

      const riskFlag = completionRate < 40 ? "stagnant" : completionRate > 70 ? "improving" : "watch";

      return {
        userId: attempt.userId,
        latestAttemptId: attemptId,
        createdAt:
          attempt.createdAt instanceof Date
            ? attempt.createdAt.toISOString()
            : String(attempt.createdAt || ""),
        exam: attempt.exam,
        scorePct,
        confidence: attempt.report?.meta?.strategy?.confidence_band || "low",
        primaryBottleneck: patterns[0]?.title || "Insufficient signal",
        actionCompletionRate: actions.length ? completionRate : 0,
        riskFlag,
      };
    })
  );

  const res = NextResponse.json({
    instituteId: session.instituteId,
    rosterCount: rosterRows.length,
    students,
  });

  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
