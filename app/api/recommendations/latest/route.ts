import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

function buildProgressSummary(plan: any) {
  const tasks = plan?.days?.flatMap((day: any) => day.tasks ?? []) ?? [];
  const tasksTotal = tasks.length;
  const tasksDone = tasks.filter((task: any) => task.status === "done").length;
  const skippedCount = tasks.filter((task: any) => task.status === "skipped").length;
  const difficultCount = tasks.filter((task: any) => task.status === "difficult").length;
  const completionRate = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const topBlockers = tasks.filter((task: any) => ["skipped", "difficult"].includes(task.status)).slice(0, 5);
  return { completionRate, tasksDone, tasksTotal, skippedCount, difficultCount, topBlockers };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const recommendations = db.collection(COLLECTIONS.recommendations);
  const attempts = db.collection(COLLECTIONS.attempts);
  const progressEvents = db.collection(COLLECTIONS.progressEvents);

  const recommendation = await recommendations.find({ userId }).sort({ createdAt: -1 }).limit(1).next();
  if (!recommendation) {
    return NextResponse.json(ok({ recommendation: null, attempt: null, progressSummary: null, recentEvents: [] }));
  }

  const attemptObjectId = ObjectId.isValid(recommendation.attemptId)
    ? new ObjectId(recommendation.attemptId)
    : null;
  const attempt = attemptObjectId ? await attempts.findOne({ _id: attemptObjectId, userId }) : null;

  const recentEvents = await progressEvents
    .find({ userId, recommendationId: recommendation._id.toString() })
    .sort({ createdAt: -1 })
    .limit(7)
    .toArray();

  return NextResponse.json(
    ok({
      recommendation: { ...recommendation, _id: recommendation._id.toString() },
      attempt: attempt ? { ...attempt, _id: attempt._id.toString() } : null,
      progressSummary: buildProgressSummary(recommendation.plan),
      recentEvents: recentEvents.map((event) => ({ ...event, _id: event._id.toString() })),
    })
  );
}
