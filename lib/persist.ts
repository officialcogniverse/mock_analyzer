import { getDb } from "./mongo";
import { ObjectId } from "mongodb";

export type CoachPersona = {
  coach_name: string;
  tone: "calm" | "tough_love" | "hype";
  style: "bullets" | "story" | "roast_light";
};

export type ProgressExam = "CAT" | "NEET" | "JEE";

export type Probe = {
  id: string; // stable id (e.g. "drill_accuracy_20q")
  title: string;
  description?: string;
  // optional tags for future routing/analytics
  tags?: string[];
  // completion fields
  done?: boolean;
  doneAt?: string; // ISO string
};

export type UserProgressDoc = {
  _id?: any;
  userId: string;
  exam: ProgressExam;
  nextMockInDays?: number; // 2|4|7|14
  minutesPerDay?: number; // 20|40|60|90
  probes?: Probe[];
  confidence?: number; // 0..100
  updatedAt?: Date;
  createdAt?: Date;
};

export type StrategyMemoryDoc = {
  _id?: any;
  userId: string;
  exam: string; // "CAT" | "NEET" | "JEE" | "UPSC"
  attemptId: string; // mock_attempts._id as string
  lever_titles: string[];
  if_then_rules: string[];
  confidence_score: number; // 0..100
  confidence_band: "high" | "medium" | "low";
  _is_fallback: boolean;
  createdAt: Date;
};


function normalizeExam(exam: any): ProgressExam | null {
  const x = String(exam || "").trim().toUpperCase();
  if (x === "CAT" || x === "NEET" || x === "JEE") return x;
  return null;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

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
export async function saveStrategyMemorySnapshot(params: {
  userId: string;
  exam: string;
  attemptId: string;
  strategyPlan: any;
}) {
  const db = await getDb();
  const col = db.collection<StrategyMemoryDoc>("strategy_memory");

  const sp = params.strategyPlan || {};
  const levers = Array.isArray(sp.top_levers) ? sp.top_levers : [];
  const lever_titles = levers
    .map((l: any) => String(l?.title || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const if_then_rules = (Array.isArray(sp.if_then_rules) ? sp.if_then_rules : [])
    .map((x: any) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 10);

  const conf = sp.confidence || {};
  const confidence_score = Number.isFinite(Number(conf.score))
    ? Math.max(0, Math.min(100, Number(conf.score)))
    : 50;

  const confidence_band = (String(conf.band || "medium").toLowerCase() === "high"
    ? "high"
    : String(conf.band || "medium").toLowerCase() === "low"
    ? "low"
    : "medium") as "high" | "medium" | "low";

  const _is_fallback = !!sp._is_fallback;

  const doc: StrategyMemoryDoc = {
    userId: params.userId,
    exam: String(params.exam || "").toUpperCase(),
    attemptId: String(params.attemptId),
    lever_titles,
    if_then_rules,
    confidence_score,
    confidence_band,
    _is_fallback,
    createdAt: new Date(),
  };

  // upsert by attemptId so re-runs overwrite same attempt snapshot
  await col.updateOne(
    { userId: params.userId, attemptId: doc.attemptId },
    { $set: doc },
    { upsert: true }
  );

  return doc;
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

/**
 * -----------------------------
 * Progress (NEW): probes + confidence + planner settings
 * Collection: user_progress
 * Key: { userId, exam }
 * -----------------------------
 */

export async function getUserProgress(userId: string, exam: string) {
  const ex = normalizeExam(exam);
  if (!ex) return null;

  const db = await getDb();
  const col = db.collection<UserProgressDoc>("user_progress");
  return col.findOne({ userId, exam: ex });
}

/**
 * Upsert progress for a given user + exam.
 * Only merges provided fields.
 */
export async function upsertUserProgress(params: {
  userId: string;
  exam: string;
  patch: Partial<UserProgressDoc>;
}) {
  const ex = normalizeExam(params.exam);
  if (!ex) throw new Error("Invalid exam");

  const db = await getDb();
  const col = db.collection<UserProgressDoc>("user_progress");

  const safePatch: any = { ...params.patch };

  if (typeof safePatch.confidence === "number") {
    safePatch.confidence = clamp(Number(safePatch.confidence), 0, 100);
  }
  if (typeof safePatch.nextMockInDays === "number") {
    safePatch.nextMockInDays = clamp(Number(safePatch.nextMockInDays), 2, 14);
  }
  if (typeof safePatch.minutesPerDay === "number") {
    safePatch.minutesPerDay = clamp(Number(safePatch.minutesPerDay), 15, 180);
  }

  safePatch.updatedAt = new Date();

  await col.updateOne(
    { userId: params.userId, exam: ex },
    {
      $setOnInsert: { userId: params.userId, exam: ex, createdAt: new Date() },
      $set: safePatch,
    },
    { upsert: true }
  );

  return col.findOne({ userId: params.userId, exam: ex });
}

/**
 * Mark a probe done/undone and recompute confidence (simple v1 heuristic).
 * Confidence is deliberately simple now; we can replace later with python engine.
 */
export async function toggleProbe(params: {
  userId: string;
  exam: string;
  probe: Probe;
  done: boolean;
}) {
  const ex = normalizeExam(params.exam);
  if (!ex) throw new Error("Invalid exam");

  const db = await getDb();
  const col = db.collection<UserProgressDoc>("user_progress");

  const existing = (await col.findOne({ userId: params.userId, exam: ex })) || {
    userId: params.userId,
    exam: ex,
    probes: [],
    confidence: 0,
  };

  const probes = Array.isArray(existing.probes) ? existing.probes.slice() : [];
  const pid = String(params.probe?.id || "").trim();
  if (!pid) throw new Error("Probe id missing");

  const nowIso = new Date().toISOString();

  const idx = probes.findIndex((p) => String(p.id) === pid);
  const nextProbe: Probe = {
    id: pid,
    title: String(params.probe.title || "Probe"),
    description: params.probe.description ? String(params.probe.description) : undefined,
    tags: Array.isArray(params.probe.tags) ? params.probe.tags.map(String) : undefined,
    done: !!params.done,
    doneAt: params.done ? nowIso : undefined,
  };

  if (idx >= 0) probes[idx] = { ...probes[idx], ...nextProbe };
  else probes.unshift(nextProbe);

  // v1 confidence: base 35 + 8 * (#done in last 7 probes), capped at 95
  const doneCount = probes.filter((p) => p.done).length;
  const confidence = clamp(35 + doneCount * 8, 0, 95);

  await col.updateOne(
    { userId: params.userId, exam: ex },
    {
      $setOnInsert: { userId: params.userId, exam: ex, createdAt: new Date() },
      $set: { probes, confidence, updatedAt: new Date() },
    },
    { upsert: true }
  );

  return col.findOne({ userId: params.userId, exam: ex });
}

export async function listStrategyMemory(userId: string, exam?: string, limit = 20) {
  const db = await getDb();
  const col = db.collection<StrategyMemoryDoc>("strategy_memory");

  const q: any = { userId };
  if (exam) q.exam = String(exam).toUpperCase();

  const rows = await col.find(q).sort({ createdAt: -1 }).limit(limit).toArray();

  return rows.map((r) => ({
    id: r._id?.toString?.() || "",
    attemptId: r.attemptId,
    exam: r.exam,
    lever_titles: r.lever_titles,
    if_then_rules: r.if_then_rules,
    confidence_score: r.confidence_score,
    confidence_band: r.confidence_band,
    _is_fallback: r._is_fallback,
    createdAt: r.createdAt,
  }));
}
