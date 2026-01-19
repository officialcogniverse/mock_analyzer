import { getDb } from "./mongo";
import { ObjectId } from "mongodb";

export type CoachPersona = {
  coach_name: string;
  tone: "calm" | "tough_love" | "hype";
  style: "bullets" | "story" | "roast_light";
};

/**
 * Create or update anonymous user
 */
export async function upsertUser(userId: string) {
  const db = await getDb();
  const users = db.collection<any>("users");

  await users.updateOne(
    { _id: userId },
    {
      $setOnInsert: {
        _id: userId, // string _id is totally valid in Mongo
        createdAt: new Date(),
        displayName: null,
        examDefault: null,
        coach: {
          coach_name: "Prof. Astra",
          tone: "calm",
          style: "bullets",
        } satisfies CoachPersona,
      },
      $set: { lastSeenAt: new Date() },
    },
    { upsert: true }
  );

  return users.findOne({ _id: userId });
}

/**
 * Save a mock attempt
 */
export async function saveAttempt(params: {
  userId: string;
  exam: string;
  intake: any;
  rawText: string;
  report: any;
}) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  const createdAt = new Date();

  const doc = {
    userId: params.userId,
    exam: String(params.exam || "").toUpperCase(), // normalize
    intake: params.intake,
    rawText: params.rawText,
    report: params.report,
    createdAt,
  };

  const res = await attempts.insertOne(doc);
  return res.insertedId.toString(); // return string id for frontend
}

/**
 * Get a single attempt by id
 */
export async function getAttemptById(id: string) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  return attempts.findOne({ _id: new ObjectId(id) });
}

/**
 * List attempts for a user (history)
 */
export async function listAttempts(userId: string, limit = 20) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  const rows = await attempts
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((r) => ({
    id: r._id.toString(),
    exam: r.exam,
    createdAt: r.createdAt,
    summary: r.report?.summary ?? "",
    focusXP: Math.min(
      100,
      (r.report?.weaknesses || []).reduce(
        (sum: number, w: any) => sum + (Number(w?.severity) || 0) * 10,
        0
      )
    ),
  }));
}

/**
 * List attempts for insights (keep payload small + stable for python)
 * IMPORTANT: return createdAt as ISO string so python cadence/streak is reliable.
 */
export async function listAttemptsForInsights(
  userId: string,
  exam?: string | null,
  limit = 20
) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  const q: any = { userId };
  if (exam) q.exam = String(exam).toUpperCase();

  const rows = await attempts
    .find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .project({ createdAt: 1, exam: 1, report: 1 })
    .toArray();

  return rows.map((r) => ({
    id: r._id.toString(),
    // ✅ Stable serialization:
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
    exam: r.exam,
    report: r.report,
  }));
}

export async function getUser(userId: string) {
  const db = await getDb();
  const users = db.collection<any>("users");
  return users.findOne({ _id: userId });
}

export async function updateUser(userId: string, patch: any) {
  const db = await getDb();
  const users = db.collection<any>("users");

  await users.updateOne(
    { _id: userId },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true }
  );

  return users.findOne({ _id: userId });
}
