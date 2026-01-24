import { normalizeReport as normalizeCanonicalReport } from "@/lib/report";
import type { ActionDoc } from "@/lib/persist";
import {
  AttemptBundleSchema,
  AttemptDetailSchema,
  AttemptSchema,
  ReportSchema,
  StudentProfileSchema,
  type ActionState,
  type Attempt,
  type AttemptBundle,
  type AttemptDetail,
  type Report,
  type StudentProfile,
} from "./schemas";

type AttemptDoc = {
  _id?: { toString(): string };
  id?: string;
  userId?: string;
  createdAt?: Date | string;
  rawText?: string;
  exam?: string;
  intake?: any;
  report?: any;
};

type UserDoc = {
  displayName?: string | null;
  profile?: Record<string, any> | null;
};

function toIsoString(value: Date | string | undefined, fallback: string) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return new Date(value).toISOString();
  return fallback;
}

function normalizeSourceType(doc: AttemptDoc): Attempt["source_type"] {
  const rawText = String(doc.rawText || "").trim();
  if (!rawText) return "upload";
  return rawText.length < 80 ? "manual" : "text";
}

function normalizeMetrics(report: any) {
  const metricsFromFacts = Array.isArray(report?.facts?.metrics) ? report.facts.metrics : [];
  const metricsFromMeta = Array.isArray(report?.meta?.metrics) ? report.meta.metrics : [];
  const metrics = metricsFromFacts.length ? metricsFromFacts : metricsFromMeta;

  return metrics
    .map((metric: any) => ({
      label: String(metric?.label || "Metric"),
      value: String(metric?.value || "—"),
      evidence: metric?.evidence ? String(metric.evidence) : undefined,
    }))
    .filter((metric: {label:string; value:string}) => metric.label && metric.value);
}

function normalizeProfile(user: UserDoc | null | undefined): StudentProfile | null {
  if (!user) return null;
  const profile = user.profile && typeof user.profile === "object" ? user.profile : {};
  const displayName = String(user.displayName || profile.displayName || "Student").trim() || "Student";

  const parsed = StudentProfileSchema.safeParse({
    displayName,
    targetExamLabel: profile.targetExamLabel ?? null,
    goal: profile.goal ?? "score",
    nextMockDate: profile.nextMockDate ?? null,
    dailyStudyMinutes: Number(profile.dailyStudyMinutes ?? 60),
    biggestStruggle: profile.biggestStruggle ?? null,
    timezone: profile.timezone ?? "Asia/Kolkata",
  });

  return parsed.success ? parsed.data : null;
}

export function normalizeAttempt(doc: AttemptDoc, fallbackUserId: string): Attempt {
  const id = doc._id?.toString?.() || doc.id || "";
  const userId = String(doc.userId || fallbackUserId || "").trim();
  const createdAt = toIsoString(doc.createdAt, new Date().toISOString());
  const metrics = normalizeMetrics(doc.report);
  const exam = String(doc.exam || doc.report?.meta?.userExam || "GENERIC").toUpperCase();

  return AttemptSchema.parse({
    id,
    user_id: userId,
    created_at: createdAt,
    source_type: normalizeSourceType(doc),
    raw_text: doc.rawText ? String(doc.rawText) : undefined,
    metrics,
    exam,
  });
}

export function normalizeReport(params: {
  doc: AttemptDoc;
  fallbackUserId: string;
  profile: StudentProfile | null;
}): Report {
  const attemptId = params.doc._id?.toString?.() || params.doc.id || "";
  const userId = String(params.doc.userId || params.fallbackUserId || "").trim();
  const createdAt = toIsoString(params.doc.createdAt, new Date().toISOString());

  const normalized = normalizeCanonicalReport(params.doc.report || {}, {
    userId,
    attemptId,
    createdAt,
    profile: params.profile,
  });

  const reportWithAttempt: Report = {
    ...normalized,
    attempt_id: attemptId,
    user_id: userId,
    created_at: createdAt,
  };

  return ReportSchema.parse(reportWithAttempt);
}

function toActionState(row: ActionDoc): ActionState {
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString();
  return {
    user_id: row.userId,
    attempt_id: row.attemptId,
    action_id: row.actionId,
    status: row.status === "completed" ? "completed" : "pending",
    updated_at: updatedAt,
    reflection: row.reflection || undefined,
  };
}

function summarizeDelta(current: Report, previous: Report) {
  const changes: string[] = [];

  if (current.primary_bottleneck !== previous.primary_bottleneck) {
    changes.push(`Primary bottleneck shifted to ${current.primary_bottleneck}.`);
  }

  const currentPatterns = new Set(current.patterns.map((p) => p.title));
  const previousPatterns = new Set(previous.patterns.map((p) => p.title));
  const newPatterns = [...currentPatterns].filter((title) => !previousPatterns.has(title));
  if (newPatterns.length) {
    changes.push(`New patterns detected: ${newPatterns.slice(0, 2).join(", ")}.`);
  }

  const currentActions = new Set(current.next_actions.map((a) => a.title));
  const previousActions = new Set(previous.next_actions.map((a) => a.title));
  const newActions = [...currentActions].filter((title) => !previousActions.has(title));
  if (newActions.length) {
    changes.push(`Action focus changed: ${newActions.slice(0, 2).join(", ")}.`);
  }

  return changes.slice(0, 3);
}

export function buildAttemptBundle(params: {
  doc: AttemptDoc;
  fallbackUserId: string;
  user: UserDoc | null;
}): AttemptBundle {
  const attempt = normalizeAttempt(params.doc, params.fallbackUserId);
  const profile = normalizeProfile(params.user);
  const report = normalizeReport({ doc: params.doc, fallbackUserId: params.fallbackUserId, profile });
  return AttemptBundleSchema.parse({ attempt, report, profile });
}

export function buildAttemptDetail(params: {
  doc: AttemptDoc;
  fallbackUserId: string;
  user: UserDoc | null;
  actions: ActionDoc[];
  previousDoc?: AttemptDoc | null;
}): AttemptDetail {
  const bundle = buildAttemptBundle({
    doc: params.doc,
    fallbackUserId: params.fallbackUserId,
    user: params.user,
  });
  const actionState = params.actions.map(toActionState);

  let deltaFromPrevious: AttemptDetail["delta_from_previous"] = null;
  if (params.previousDoc?._id) {
    const previousBundle = buildAttemptBundle({
      doc: params.previousDoc,
      fallbackUserId: params.fallbackUserId,
      user: params.user,
    });
    const changes = summarizeDelta(bundle.report, previousBundle.report);
    deltaFromPrevious = {
      previous_attempt_id: previousBundle.attempt.id,
      summary: changes.length
        ? "Here is what changed since your last attempt."
        : "No meaningful delta yet—complete your next actions before the next mock.",
      changes,
    };
  }

  return AttemptDetailSchema.parse({
    ...bundle,
    action_state: actionState,
    delta_from_previous: deltaFromPrevious,
  });
}
