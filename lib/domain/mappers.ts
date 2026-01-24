import { normalizeReport as normalizeLegacyReport, deriveFallbackActions } from "@/lib/report";
import type { ActionDoc } from "@/lib/persist";
import {
  AttemptBundleSchema,
  AttemptDetailSchema,
  AttemptSchema,
  ReportSchema,
  type ActionState,
  type Attempt,
  type AttemptBundle,
  type AttemptDetail,
  type Report,
} from "./schemas";

type AttemptDoc = {
  _id?: { toString(): string };
  id?: string;
  userId?: string;
  createdAt?: Date | string;
  rawText?: string;
  report?: any;
};

function toIsoString(value: Date | string | undefined, fallback: string) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return new Date(value).toISOString();
  return fallback;
}

function actionSlug(title: string, idx: number) {
  const base =
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `action-${idx + 1}`;
  return base.slice(0, 64);
}

function patternSlug(title: string, idx: number) {
  const base =
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `pattern-${idx + 1}`;
  return base.slice(0, 64);
}

function normalizeSourceType(doc: AttemptDoc): Attempt["sourceType"] {
  const rawText = String(doc.rawText || "").trim();
  if (!rawText) return "upload";
  return rawText.length < 80 ? "manual" : "text";
}

function normalizeMetrics(report: any) {
  const metrics = Array.isArray(report?.facts?.metrics) ? report.facts.metrics : [];
  return metrics
    .map((metric: any) => ({
      label: String(metric?.label || "Metric"),
      value: String(metric?.value || "—"),
      evidence: metric?.evidence ? String(metric.evidence) : undefined,
    }))
    .filter((metric) => metric.label && metric.value);
}

function normalizeConfidenceBand(band: unknown): "low" | "medium" | "high" {
  const value = String(band || "").toLowerCase();
  if (value === "high") return "high";
  if (value === "low") return "low";
  return "medium";
}

function normalizeSignalQuality(report: any) {
  const sq = report?.signal_quality || {};
  const scoreRaw = Number.isFinite(Number(sq?.score)) ? Number(sq.score) : 0;
  const score = Math.max(0, Math.min(100, scoreRaw || 0));
  return {
    score,
    band: normalizeConfidenceBand(sq?.band),
    missingSignals: Array.isArray(sq?.missing_signals) ? sq.missing_signals.map(String) : [],
  };
}

function normalizeConfidence(report: any, signalQuality: { missingSignals: string[] }) {
  const confidence = report?.confidence || {};
  const scoreRaw = Number.isFinite(Number(confidence?.score)) ? Number(confidence.score) : 0;
  const score = Math.max(0, Math.min(100, scoreRaw || 0));
  const assumptions = Array.isArray(report?.meta?.strategy?.assumptions)
    ? report.meta.strategy.assumptions.map(String)
    : [];

  return {
    score,
    band: normalizeConfidenceBand(confidence?.band),
    assumptions,
    missingSignals: signalQuality.missingSignals,
  };
}

function normalizePlan(report: any) {
  const plan = report?.plan || {};
  return {
    days: Array.isArray(plan?.days) ? plan.days : [],
    levers: Array.isArray(plan?.levers) ? plan.levers : [],
    rules: Array.isArray(plan?.rules) ? plan.rules.map(String) : [],
    assumptions: Array.isArray(plan?.assumptions) ? plan.assumptions.map(String) : [],
  };
}

function normalizePatterns(report: any) {
  const patterns = Array.isArray(report?.patterns) ? report.patterns : [];
  return patterns.map((pattern: any, idx: number) => ({
    id: patternSlug(pattern?.title, idx),
    title: String(pattern?.title || `Pattern ${idx + 1}`),
    evidence: String(pattern?.evidence || "Evidence not provided."),
    impact: String(pattern?.impact || "Impact unknown."),
    fix: String(pattern?.fix || "No fix provided."),
  }));
}

function normalizeActions(report: any) {
  const actions = Array.isArray(report?.next_actions) ? report.next_actions : [];
  const fallback = actions.length ? actions : deriveFallbackActions(report?.primary_bottleneck);
  return fallback.map((action: any, idx: number) => ({
    id: actionSlug(action?.title, idx),
    title: String(action?.title || `Next action ${idx + 1}`),
    duration: String(action?.duration || "~20 min"),
    expectedImpact: String(action?.expected_impact || "Medium"),
    steps: Array.isArray(action?.steps) ? action.steps.map(String) : [],
  }));
}

export function normalizeAttempt(doc: AttemptDoc, fallbackUserId: string): Attempt {
  const id = doc._id?.toString?.() || doc.id || "";
  const userId = String(doc.userId || fallbackUserId || "").trim();
  const createdAt = toIsoString(doc.createdAt, new Date().toISOString());
  const metrics = normalizeMetrics(doc.report);

  return AttemptSchema.parse({
    id,
    userId,
    createdAt,
    sourceType: normalizeSourceType(doc),
    rawText: doc.rawText ? String(doc.rawText) : undefined,
    metrics,
  });
}

export function normalizeReport(doc: AttemptDoc, fallbackUserId: string): Report {
  const attemptId = doc._id?.toString?.() || doc.id || "";
  const userId = String(doc.userId || fallbackUserId || "").trim();
  const legacy: any = normalizeLegacyReport(doc.report || {});
  const signalQuality = normalizeSignalQuality(legacy);
  const confidence = normalizeConfidence(legacy, signalQuality);
  const plan = normalizePlan(legacy);

  const report: Report = {
    attemptId,
    userId,
    summary: String(legacy.summary || "We generated a report, but the summary was missing."),
    patterns: normalizePatterns(legacy),
    nextActions: normalizeActions(legacy),
    strategy: {
      nextMockScript: Array.isArray(legacy?.strategy?.next_mock_script)
        ? legacy.strategy.next_mock_script.map(String)
        : [],
      attemptRules: Array.isArray(legacy?.strategy?.attempt_rules)
        ? legacy.strategy.attempt_rules.map(String)
        : [],
    },
    plan,
    confidence,
    signalQuality,
  };

  return ReportSchema.parse(report);
}

function toActionState(row: ActionDoc): ActionState {
  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString();
  const status = row.status === "completed" ? "completed" : "pending";
  return {
    userId: row.userId,
    attemptId: row.attemptId,
    actionId: row.actionId,
    status,
    updatedAt,
    reflection: row.reflection || undefined,
  };
}

function summarizeDelta(current: Report, previous: Report) {
  const changes: string[] = [];

  if (current.summary !== previous.summary) {
    changes.push("Summary insights shifted compared to the previous attempt.");
  }

  const currentPatterns = new Set(current.patterns.map((p) => p.title));
  const previousPatterns = new Set(previous.patterns.map((p) => p.title));
  const newPatterns = [...currentPatterns].filter((title) => !previousPatterns.has(title));
  if (newPatterns.length) {
    changes.push(`New patterns detected: ${newPatterns.slice(0, 2).join(", ")}.`);
  }

  const currentActions = new Set(current.nextActions.map((a) => a.title));
  const previousActions = new Set(previous.nextActions.map((a) => a.title));
  const newActions = [...currentActions].filter((title) => !previousActions.has(title));
  if (newActions.length) {
    changes.push(`Action focus changed: ${newActions.slice(0, 2).join(", ")}.`);
  }

  return changes.slice(0, 3);
}

export function buildAttemptBundle(doc: AttemptDoc, fallbackUserId: string): AttemptBundle {
  const attempt = normalizeAttempt(doc, fallbackUserId);
  const report = normalizeReport(doc, fallbackUserId);
  return AttemptBundleSchema.parse({ attempt, report });
}

export function buildAttemptDetail(params: {
  doc: AttemptDoc;
  fallbackUserId: string;
  actions: ActionDoc[];
  previousDoc?: AttemptDoc | null;
}): AttemptDetail {
  const bundle = buildAttemptBundle(params.doc, params.fallbackUserId);
  const actionState = params.actions.map(toActionState);

  let deltaFromPrevious: AttemptDetail["deltaFromPrevious"] = null;
  if (params.previousDoc?._id) {
    const previousBundle = buildAttemptBundle(params.previousDoc, params.fallbackUserId);
    const changes = summarizeDelta(bundle.report, previousBundle.report);
    deltaFromPrevious = {
      previousAttemptId: previousBundle.attempt.id,
      summary: changes.length
        ? "Here is what changed since your last attempt."
        : "We did not detect meaningful changes yet—focus on completing your next actions.",
      changes,
    };
  }

  return AttemptDetailSchema.parse({
    ...bundle,
    actionState,
    deltaFromPrevious,
  });
}
