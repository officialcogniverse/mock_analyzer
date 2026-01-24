import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import {
  getAttemptForUser,
  getLatestAttemptForExam,
  type ActionDoc,
  getUser,
} from "@/lib/persist";
import { getDb } from "@/lib/mongo";
import { buildAttemptDetail } from "@/lib/domain/mappers";

export const runtime = "nodejs";

const DEV_LOG = process.env.NODE_ENV !== "production";

async function loadActions(userId: string, attemptId: string) {
  const db = await getDb();
  const actions = db.collection<ActionDoc>("actions");
  return actions.find({ userId, attemptId }).toArray();
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Attempts are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const { id } = await context.params;
  const attemptId = String(id || "").trim();
  if (!ObjectId.isValid(attemptId)) {
    const res = NextResponse.json({ error: "Invalid attempt id." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const doc = await getAttemptForUser({
    attemptId,
    userId: session.userId,
    backfillMissingUserId: true,
  });

  if (!doc) {
    const res = NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const [previousDoc, actions, user] = await Promise.all([
    getLatestAttemptForExam({
      userId: session.userId,
      exam: doc.exam,
      excludeAttemptId: attemptId,
    }),
    loadActions(session.userId, attemptId),
    getUser(session.userId),
  ]);

  if (DEV_LOG) {
    console.debug("[api.attempts] fetched report keys", {
      attemptId,
      keys: doc.report && typeof doc.report === "object" ? Object.keys(doc.report) : [],
      nextActions: Array.isArray(doc.report?.next_actions) ? doc.report.next_actions.length : 0,
      probes: Array.isArray(doc.report?.probes) ? doc.report.probes.length : 0,
    });
  }

  const detail = buildAttemptDetail({
    doc,
    fallbackUserId: session.userId,
    user,
    actions,
    previousDoc,
  });

  const res = NextResponse.json(detail);
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
