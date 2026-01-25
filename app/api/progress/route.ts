import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { ProgressEventSchema } from "@/lib/schemas/workflow";
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const body = await req.json();
  const parsed = ProgressEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      fail("INVALID_INPUT", "Invalid progress payload.", mapZodError(parsed.error)),
      { status: 400 }
    );
  }

  const db = await getDb();
  await ensureIndexes(db);
  const recommendations = db.collection(COLLECTIONS.recommendations);
  const progressEvents = db.collection(COLLECTIONS.progressEvents);

  const recommendationObjectId = ObjectId.isValid(parsed.data.recommendationId)
    ? new ObjectId(parsed.data.recommendationId)
    : null;
  if (!recommendationObjectId) {
    return NextResponse.json(fail("INVALID_ID", "Invalid recommendation id."), { status: 400 });
  }

  const recommendation = await recommendations.findOne({ _id: recommendationObjectId, userId });
  if (!recommendation) {
    return NextResponse.json(fail("NOT_FOUND", "Recommendation not found."), { status: 404 });
  }

  let fromStatus: string | null = null;
  let updated = false;
  const plan = recommendation.plan;
  for (const day of plan.days ?? []) {
    for (const task of day.tasks ?? []) {
      if (task.id === parsed.data.taskId) {
        fromStatus = task.status;
        task.status = parsed.data.status;
        if (parsed.data.note !== undefined) {
          task.note = parsed.data.note;
        }
        updated = true;
      }
    }
  }

  if (!updated) {
    return NextResponse.json(fail("NOT_FOUND", "Task not found."), { status: 404 });
  }

  await recommendations.updateOne({ _id: recommendationObjectId, userId }, { $set: { plan } });

  const eventType =
    parsed.data.note && fromStatus === parsed.data.status ? "NOTE_ADDED" : "TASK_STATUS_CHANGED";

  await progressEvents.insertOne({
    userId,
    attemptId: recommendation.attemptId ?? null,
    recommendationId: recommendation._id.toString(),
    createdAt: new Date(),
    type: eventType,
    payload: {
      taskId: parsed.data.taskId,
      from: fromStatus,
      to: parsed.data.status,
      note: parsed.data.note ?? null,
    },
  });

  const recentEvents = await progressEvents
    .find({ userId, recommendationId: recommendation._id.toString() })
    .sort({ createdAt: -1 })
    .limit(7)
    .toArray();

  return NextResponse.json(
    ok({
      progressSummary: buildProgressSummary(plan),
      recentEvents: recentEvents.map((event) => ({ ...event, _id: event._id.toString() })),
    })
  );
}
