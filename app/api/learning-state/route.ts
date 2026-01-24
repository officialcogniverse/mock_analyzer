import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeExam } from "@/lib/exams";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { getUserLearningState, upsertUser } from "@/lib/persist";

export const runtime = "nodejs";

const examSchema = z.string().optional();

/**
 * GET /api/learning-state?exam=CAT
 */
export async function GET(req: Request) {
  const session = ensureUserId(req);
  const url = new URL(req.url);

  const examRaw = url.searchParams.get("exam") || "";
  const parsed = examSchema.safeParse(examRaw);
  const exam = normalizeExam(parsed.success ? parsed.data : examRaw) || "GENERIC";

  await upsertUser(session.userId);

  const doc = await getUserLearningState(session.userId, exam);

  const res = NextResponse.json({
    learningState: doc || {
      userId: session.userId,
      exam,
      attemptCount: 0,
      rollingScorePct: null,
      lastDeltaScorePct: null,
      rollingDeltaScorePct: null,
      weakTopics: [],
      strategyConfidenceBand: null,
    },
  });

  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
