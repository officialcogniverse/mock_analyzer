import { ObjectId } from "mongodb";
import { type Exam, normalizeExam } from "./exams";
import { getDb } from "./mongo";

export type CoachPersona = {
  coach_name: string;
  tone: "calm" | "tough_love" | "hype";
  style: "bullets" | "story" | "roast_light";
};

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
  exam: Exam;
  nextMockInDays?: number; // 2|4|7|14
  minutesPerDay?: number; // 20|40|60|90
  probes?: Probe[];
  probeMetrics?: Record<
    string,
    {
      accuracy?: number;
      time_min?: number;
      self_confidence?: number;
      notes?: string;
    }
  >;
  practiceMetrics?: Record<
    string,
    {
      accuracy?: number;
      time_min?: number;
      score?: number;
      notes?: string;
    }
  >;
  sectionTimings?: Array<{
    section: string;
    minutes: number | null;
    order?: number | null;
    source?: "manual" | "ocr";
  }>;
  reminder?: {
    time?: string | null;
    channel?: "whatsapp" | "email" | "sms" | "push" | "none";
  };
  planAdherence?: Array<{
    date: string;
    done: boolean;
  }>;
  confidence?: number; // 0..100
  updatedAt?: Date;
  createdAt?: Date;
};

export type StrategyMemoryDoc = {
  _id?: any;
  userId: string;
  exam: string; // "CAT" | "NEET" | "JEE"
  attemptId: string; // mock_attempts._id as string
  lever_titles: string[];
  if_then_rules: string[];
  confidence_score: number; // 0..100
  confidence_band: "high" | "medium" | "low";
  _is_fallback: boolean;
  createdAt: Date;
};

export type UserLearningStateDoc = {
  _id?: any;
  userId: string;
  exam: Exam;
  attemptCount: number;
  lastAttemptAt?: Date;
  lastScoreValue?: number | null;
  lastScoreMax?: number | null;
  lastScorePct?: number | null;
  rollingScorePct?: number | null;
  lastDeltaScorePct?: number | null;
  rollingDeltaScorePct?: number | null;
  weakTopics?: string[];
  strategyConfidenceBand?: "high" | "medium" | "low" | null;
  updatedAt?: Date;
  createdAt?: Date;
};

export type AnalyticsEventDoc = {
  _id?: any;
  userId: string;
  event: string;
  metadata?: Record<string, any>;
  createdAt: Date;
};


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
        profile: {
          preferredMockDay: null,
          examAttempt: null,
          focusArea: null,
          studyGroup: null,
        },
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

export async function getLatestAttemptForExam(params: {
  userId: string;
  exam: string;
  excludeAttemptId?: string;
}) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  const q: any = { userId: params.userId, exam: String(params.exam).toUpperCase() };
  if (params.excludeAttemptId) {
    q._id = { $ne: new ObjectId(params.excludeAttemptId) };
  }

  return attempts.find(q).sort({ createdAt: -1 }).limit(1).next();
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
    focusXP:
      r.report?.meta?.focusXP ??
      Math.min(100, Array.isArray(r.report?.patterns) ? r.report.patterns.length * 12 : 0),
    estimatedScore: null,
    errorTypes: r.report?.error_types ?? {},
  }));
}

export async function listAttemptsForExport(userId: string, limit = 200) {
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
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
    summary: r.report?.summary ?? "",
    estimated_score: r.report?.estimated_score ?? null,
    percentile: r.report?.percentile ?? null,
    accuracy: r.report?.accuracy ?? r.report?.accuracy_pct ?? null,
    error_types: r.report?.error_types ?? {},
    strengths: r.report?.strengths ?? [],
    weaknesses: r.report?.weaknesses ?? [],
    section_breakdown: r.report?.section_breakdown ?? [],
    meta: r.report?.meta ?? {},
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

export async function listCohortAttempts(exam?: string | null, limit = 300) {
  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");

  const q: any = {};
  if (exam) q.exam = String(exam).toUpperCase();

  const rows = await attempts
    .find(q)
    .sort({ createdAt: -1 })
    .limit(limit)
    .project({ userId: 1, createdAt: 1, exam: 1, report: 1 })
    .toArray();

  return rows.map((r) => ({
    id: r._id.toString(),
    userId: r.userId,
    exam: r.exam,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ""),
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
  const ex = normalizeExam(exam) || "GENERIC";

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
  const ex = normalizeExam(params.exam) || "GENERIC";

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
  const ex = normalizeExam(params.exam) || "GENERIC";

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

export async function getUserLearningState(userId: string, exam: string) {
  const ex = normalizeExam(exam) || "GENERIC";

  const db = await getDb();
  const col = db.collection<UserLearningStateDoc>("user_learning_state");

  return col.findOne({ userId, exam: ex });
}

export async function updateUserLearningStateFromReport(params: {
  userId: string;
  exam: string;
  report: any;
  attemptId?: string;
}) {
  const ex = normalizeExam(params.exam) || "GENERIC";


  const db = await getDb();
  const col = db.collection<UserLearningStateDoc>("user_learning_state");

  const existing =
    (await col.findOne({ userId: params.userId, exam: ex })) || null;

  const metrics = Array.isArray(params.report?.facts?.metrics)
    ? params.report.facts.metrics
    : [];
  const scoreMetric = metrics.find((m: any) =>
    String(m?.label || "").toLowerCase().includes("score")
  );
  const percentileMetric = metrics.find((m: any) =>
    String(m?.label || "").toLowerCase().includes("percentile")
  );

  function parseNumber(value: any) {
    const num = Number(String(value || "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) ? num : null;
  }

  const scoreValue = parseNumber(scoreMetric?.value);
  const scoreMax = parseNumber(scoreMetric?.value?.split?.("/")?.[1]);
  const percentileValue = parseNumber(percentileMetric?.value);

  const lastScoreValue = scoreValue;
  const lastScoreMax = scoreMax;
  const lastScorePct =
    scoreValue !== null && scoreMax !== null && scoreMax > 0
      ? Math.round((scoreValue / scoreMax) * 100)
      : percentileValue ?? null;

  const prevAttempt = params.attemptId
    ? await getLatestAttemptForExam({
        userId: params.userId,
        exam: ex,
        excludeAttemptId: params.attemptId,
      })
    : null;

  const prevMetrics = Array.isArray(prevAttempt?.report?.facts?.metrics)
    ? prevAttempt.report.facts.metrics
    : [];
  const prevScoreMetric = prevMetrics.find((m: any) =>
    String(m?.label || "").toLowerCase().includes("score")
  );
  const prevScoreValue = parseNumber(prevScoreMetric?.value);
  const prevScoreMax = parseNumber(prevScoreMetric?.value?.split?.("/")?.[1]);
  const prevScorePct =
    prevScoreValue !== null && prevScoreMax !== null && prevScoreMax > 0
      ? Math.round((prevScoreValue / prevScoreMax) * 100)
      : null;

  const lastDeltaScorePct =
    lastScorePct !== null && prevScorePct !== null
      ? lastScorePct - prevScorePct
      : null;

  const weaknessTopics = Array.isArray(params.report?.patterns)
    ? params.report.patterns
        .map((p: any) => String(p?.title || "").trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const strategyConfidenceBand =
    params.report?.meta?.strategy?.confidence_band ??
    params.report?.meta?.strategy_plan?.confidence?.band ??
    null;

  const rollingScorePct =
    lastScorePct === null
      ? existing?.rollingScorePct ?? null
      : existing?.rollingScorePct === undefined ||
          existing?.rollingScorePct === null
        ? lastScorePct
        : Math.round(existing.rollingScorePct * 0.7 + lastScorePct * 0.3);

  const rollingDeltaScorePct =
    lastDeltaScorePct === null
      ? existing?.rollingDeltaScorePct ?? null
      : existing?.rollingDeltaScorePct === undefined ||
          existing?.rollingDeltaScorePct === null
        ? lastDeltaScorePct
        : Number(
            (existing.rollingDeltaScorePct * 0.7 + lastDeltaScorePct * 0.3).toFixed(1)
          );

  const attemptCount = Math.max(1, Number(existing?.attemptCount || 0) + 1);

  const patch: Partial<UserLearningStateDoc> = {
    attemptCount,
    lastAttemptAt: new Date(),
    lastScoreValue,
    lastScoreMax,
    lastScorePct,
    rollingScorePct,

    lastDeltaScorePct,
    rollingDeltaScorePct,
    weakTopics: weaknessTopics,
    strategyConfidenceBand:
      strategyConfidenceBand === "high" ||
      strategyConfidenceBand === "medium" ||
      strategyConfidenceBand === "low"
        ? strategyConfidenceBand
        : null,
    updatedAt: new Date(),
  };

  await col.updateOne(
    { userId: params.userId, exam: ex },
    {
      $setOnInsert: { userId: params.userId, exam: ex, createdAt: new Date() },
      $set: patch,
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

export async function saveEvent(params: {
  userId: string;
  event: string;
  metadata?: Record<string, any>;
}) {
  const db = await getDb();
  const col = db.collection<AnalyticsEventDoc>("analytics_events");

  await col.insertOne({
    userId: params.userId,
    event: params.event,
    metadata: params.metadata || {},
    createdAt: new Date(),
  });
}

export async function createOtpRequest(email: string, code: string) {
  const db = await getDb();
  const col = db.collection<any>("otp_requests");

  const normalized = email.trim().toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  await col.insertOne({
    email: normalized,
    code,
    createdAt: now,
    expiresAt,
  });

  return { email: normalized, expiresAt };
}

export async function verifyOtpCode(email: string, code: string) {
  const db = await getDb();
  const col = db.collection<any>("otp_requests");

  const normalized = email.trim().toLowerCase();
  const now = new Date();

  const match = await col.findOne(
    { email: normalized, code, expiresAt: { $gt: now } },
    { sort: { createdAt: -1 } }
  );

  return !!match;
}

export async function migrateUserData(params: { fromUserId: string; toUserId: string }) {
  const { fromUserId, toUserId } = params;
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  const db = await getDb();
  const attempts = db.collection<any>("mock_attempts");
  const progress = db.collection<UserProgressDoc>("user_progress");
  const learning = db.collection<UserLearningStateDoc>("user_learning_state");
  const strategy = db.collection<StrategyMemoryDoc>("strategy_memory");
  const users = db.collection<any>("users");

  await attempts.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } });
  await learning.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } });
  await strategy.updateMany({ userId: fromUserId }, { $set: { userId: toUserId } });

  const fromProgress = await progress.find({ userId: fromUserId }).toArray();
  for (const doc of fromProgress) {
    const existing = await progress.findOne({ userId: toUserId, exam: doc.exam });
    if (!existing) {
      await progress.updateOne(
        { _id: doc._id },
        { $set: { userId: toUserId } }
      );
      continue;
    }

    const mergedProbes = [
      ...(existing.probes || []),
      ...(doc.probes || []),
    ];
    const uniqueProbes = Array.from(
      new Map(mergedProbes.map((p) => [p.id, p])).values()
    );

    const merged = {
      probes: uniqueProbes,
      probeMetrics: { ...(existing.probeMetrics || {}), ...(doc.probeMetrics || {}) },
      practiceMetrics: {
        ...(existing.practiceMetrics || {}),
        ...(doc.practiceMetrics || {}),
      },
      sectionTimings: doc.sectionTimings || existing.sectionTimings,
      reminder: doc.reminder || existing.reminder,
      planAdherence: doc.planAdherence || existing.planAdherence,
      confidence:
        typeof doc.confidence === "number" ? doc.confidence : existing.confidence,
      updatedAt: new Date(),
    };

    await progress.updateOne(
      { userId: toUserId, exam: doc.exam },
      { $set: merged }
    );
    await progress.deleteOne({ _id: doc._id });
  }

  await users.deleteOne({ _id: fromUserId });
}
