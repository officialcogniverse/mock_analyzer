import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { getDb } from "@/lib/mongo";
import { COLLECTIONS } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = ensureSession(req);
  const { id } = await context.params;
  const attemptId = String(id || "").trim();

  if (!ObjectId.isValid(attemptId)) {
    const res = NextResponse.json({ error: "Invalid attempt id." }, { status: 400 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const db = await getDb();
  const attempts = db.collection(COLLECTIONS.attempts);
  const recommendations = db.collection(COLLECTIONS.recommendations);

  const attempt = await attempts.findOne({
    _id: new ObjectId(attemptId),
    userId: session.userId,
  });

  if (!attempt) {
    const res = NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const recommendation = await recommendations.findOne({
    attemptId,
    userId: session.userId,
  });

  if (!recommendation) {
    const res = NextResponse.json({ error: "Recommendation not found." }, { status: 404 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  const res = NextResponse.json({
    ok: true,
    attempt: {
      ...attempt,
      _id: attempt._id.toString(),
      createdAt: attempt.createdAt ? new Date(attempt.createdAt).toISOString() : null,
    },
    recommendation: {
      ...recommendation,
      _id: recommendation._id.toString(),
      createdAt: recommendation.createdAt ? new Date(recommendation.createdAt).toISOString() : null,
    },
  });
  if (session.isNew) attachSessionCookie(res, session);
  return res;
}
