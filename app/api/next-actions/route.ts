import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeExam } from "@/lib/exams";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import {
  getLatestAttemptForExam,
  getUserLearningState,
  getUserProgress,
  upsertUser,
} from "@/lib/persist";

export const runtime = "nodejs";

const examSchema = z.string().optional();

type NextAction = {
  id: string;
  title: string;
  steps: string[];
  metric?: string;
  expectedImpact: "High" | "Medium" | "Low";
  effort: string;
  evidence: string[];
  score: number;
};

function toId(input: string, idx: number) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `action-${idx + 1}`
  );
}

function expectedImpactFromDelta(delta: number | null | undefined, idx: number) {
  if (typeof delta === "number" && delta < 0) return idx === 0 ? "High" : "Medium";
  if (typeof delta === "number" && delta > 0) return idx === 0 ? "Medium" : "Low";
  return idx === 0 ? "Medium" : "Low";
}

function buildEvidence(params: {
  weakTopics?: string[];
  lastDeltaScorePct?: number | null;
  strategyBand?: string | null;
  probeAccuracy?: number | null;
}) {
  const evidence: string[] = [];
  if (typeof params.lastDeltaScorePct === "number") {
    if (params.lastDeltaScorePct < 0)
      evidence.push("Recent score dipped vs last mock");
    if (params.lastDeltaScorePct > 0)
      evidence.push("Recent score improved vs last mock");
  }
  if (params.weakTopics && params.weakTopics.length) {
    evidence.push(`Weak topics: ${params.weakTopics.slice(0, 2).join(", ")}`);
  }
  if (typeof params.probeAccuracy === "number") {
    evidence.push(`Probe accuracy avg: ${params.probeAccuracy}%`);
  }
  if (params.strategyBand === "low") {
    evidence.push("Low signal confidence in strategy");
  }
  return evidence;
}

function scoreAction(params: {
  base: number;
  title: string;
  steps: string[];
  weakTopics?: string[];
  lastDeltaScorePct?: number | null;
}) {
  let score = params.base;
  if (typeof params.lastDeltaScorePct === "number" && params.lastDeltaScorePct < 0) {
    score += 8;
  }
  const haystack = [params.title, ...params.steps].join(" ").toLowerCase();
  const matches = (params.weakTopics || []).filter((t) =>
    haystack.includes(String(t).toLowerCase())
  );
  score += Math.min(matches.length * 3, 9);
  return score;
}

/**
 * GET /api/next-actions?exam=CAT
 */
export async function GET(req: Request) {
  const session = ensureUserId(req);
  const url = new URL(req.url);

  const examRaw = url.searchParams.get("exam") || "";
  const parsed = examSchema.safeParse(examRaw);
  const exam = normalizeExam(parsed.success ? parsed.data : examRaw) || "GENERIC";

  await upsertUser(session.userId);

  const [learningState, latestAttempt, progress] = await Promise.all([
    getUserLearningState(session.userId, exam),
    getLatestAttemptForExam({ userId: session.userId, exam }),
    getUserProgress(session.userId, exam),
  ]);

  const strategyPlan = latestAttempt?.report?.meta?.strategy_plan;
  const topActions = Array.isArray(latestAttempt?.report?.next_actions)
    ? latestAttempt?.report?.next_actions.map((action: any) => action.title)
    : [];

  const probeMetrics = progress?.probeMetrics || {};
  const probeAccuracyValues = Object.values(probeMetrics)
    .map((m) => Number(m?.accuracy))
    .filter((n) => Number.isFinite(n));
  const probeAccuracy =
    probeAccuracyValues.length > 0
      ? Math.round(
          probeAccuracyValues.reduce((a, b) => a + b, 0) / probeAccuracyValues.length
        )
      : null;

  const evidenceBase = buildEvidence({
    weakTopics: learningState?.weakTopics,
    lastDeltaScorePct: learningState?.lastDeltaScorePct ?? null,
    strategyBand: learningState?.strategyConfidenceBand ?? null,
    probeAccuracy,
  });

  let actions: NextAction[] = [];

  if (strategyPlan?.top_levers?.length) {
    actions = strategyPlan.top_levers.map((lever: any, idx: number) => {
      const steps = Array.isArray(lever.do) ? lever.do : [];
      const evidence = ["From latest strategy plan", ...evidenceBase].slice(0, 3);
      const base = 100 - idx * 6;
      const score = scoreAction({
        base,
        title: String(lever.title || `Action ${idx + 1}`),
        steps,
        weakTopics: learningState?.weakTopics,
        lastDeltaScorePct: learningState?.lastDeltaScorePct ?? null,
      });
      return {
        id: toId(String(lever.title || `Action ${idx + 1}`), idx),
        title: String(lever.title || `Action ${idx + 1}`),
        steps,
        metric: lever.metric ? String(lever.metric) : undefined,
        expectedImpact: expectedImpactFromDelta(
          learningState?.lastDeltaScorePct ?? null,
          idx
        ),
        effort: "20–30 min",
        evidence,
        score,
      };
    });
  } else if (topActions.length) {
    actions = topActions.map((action: string, idx: number) => {
      const title = String(action || `Action ${idx + 1}`);
      const evidence = ["From latest analysis", ...evidenceBase].slice(0, 3);
      const score = scoreAction({
        base: 90 - idx * 6,
        title,
        steps: [],
        weakTopics: learningState?.weakTopics,
        lastDeltaScorePct: learningState?.lastDeltaScorePct ?? null,
      });
      return {
        id: toId(title, idx),
        title,
        steps: [],
        expectedImpact: expectedImpactFromDelta(
          learningState?.lastDeltaScorePct ?? null,
          idx
        ),
        effort: "15–25 min",
        evidence,
        score,
      };
    });
  }

  const ranked = actions.sort((a, b) => b.score - a.score).slice(0, 3);

  const res = NextResponse.json({
    actions: ranked,
    learningState: learningState || null,
  });

  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
