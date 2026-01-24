import { NextResponse } from "next/server";
import { listCohortAttempts } from "@/lib/persist";
import { getDb } from "@/lib/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "200"), 400);

  const attempts = await listCohortAttempts(null, limit);

  const latestByUser = new Map<string, (typeof attempts)[number]>();
  attempts.forEach((attempt) => {
    if (!latestByUser.has(attempt.userId)) {
      latestByUser.set(attempt.userId, attempt);
    }
  });

  const attemptIds = Array.from(latestByUser.values()).map((a) => a.id);

  const db = await getDb();
  const events = db.collection<any>("analytics_events");

  const completionCounts: Record<string, number> = {};
  if (attemptIds.length) {
    const rows = await events
      .find({
        event: "action_completed",
        "metadata.reportId": { $in: attemptIds },
      })
      .toArray();

    rows.forEach((row) => {
      const reportId = row?.metadata?.reportId;
      if (!reportId) return;
      completionCounts[reportId] = (completionCounts[reportId] || 0) + 1;
    });
  }

  const students = Array.from(latestByUser.values()).map((attempt) => {
    const patterns = Array.isArray(attempt.report?.patterns) ? attempt.report.patterns : [];
    const actions = Array.isArray(attempt.report?.next_actions)
      ? attempt.report.next_actions
      : [];
    const completed = completionCounts[attempt.id] || 0;
    const completionRate = actions.length
      ? Math.min(100, Math.round((completed / actions.length) * 100))
      : 0;

    return {
      userId: attempt.userId,
      latestAttemptId: attempt.id,
      createdAt: attempt.createdAt,
      exam: attempt.exam,
      confidence: attempt.report?.meta?.strategy?.confidence_band || "low",
      primaryBottleneck: patterns[0]?.title || "Insufficient signal",
      actionCompletionRate: completionRate,
    };
  });

  return NextResponse.json({ students });
}
