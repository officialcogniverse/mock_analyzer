import { NextResponse } from "next/server";
import { listCohortAttempts } from "@/lib/persist";
import { normalizeExam } from "@/lib/exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function percentile(values: number[], p: number) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return Math.round(sorted[idx]);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const exam = normalizeExam(url.searchParams.get("exam") || "");

  const rawLimit = Number(url.searchParams.get("limit") || "200");
  const limit = Math.max(50, Math.min(400, Number.isFinite(rawLimit) ? rawLimit : 200));

  const attempts = await listCohortAttempts(exam, limit);

  const scorePcts: number[] = [];
  const errorTotals: Record<string, number> = {
    conceptual: 0,
    careless: 0,
    time: 0,
    comprehension: 0,
  };
  let errorCount = 0;

  const byUser: Record<string, number[]> = {};

  attempts.forEach((attempt) => {
    const report = attempt.report || {};
    const percentileValue = Number(report?.percentile);
    const scoreValue = Number(report?.estimated_score?.value);
    const scoreMax = Number(report?.estimated_score?.max);
    const scorePct =
      Number.isFinite(scoreValue) && Number.isFinite(scoreMax) && scoreMax > 0
        ? Math.round((scoreValue / scoreMax) * 100)
        : null;

    const metric = Number.isFinite(percentileValue) ? percentileValue : scorePct;
    if (metric != null) scorePcts.push(metric);

    const errors = report?.error_types || {};
    if (errors && typeof errors === "object") {
      Object.keys(errorTotals).forEach((key) => {
        if (Number.isFinite(Number(errors[key]))) {
          errorTotals[key] += Number(errors[key]);
        }
      });
      errorCount += 1;
    }

    if (!byUser[attempt.userId]) byUser[attempt.userId] = [];
    if (scorePct != null) byUser[attempt.userId].push(scorePct);
  });

  const avgErrors: Record<string, number> = {};
  Object.entries(errorTotals).forEach(([key, total]) => {
    avgErrors[key] = errorCount ? Math.round(total / errorCount) : 0;
  });

  const deltas: number[] = [];
  Object.values(byUser).forEach((scores) => {
    if (scores.length < 2) return;
    const [latest, previous] = scores.slice(0, 2);
    deltas.push(latest - previous);
  });

  const response = {
    cohortSize: Object.keys(byUser).length,
    attemptsCount: attempts.length,
    scoreBenchmarks: {
      p50: percentile(scorePcts, 50),
      p75: percentile(scorePcts, 75),
      p90: percentile(scorePcts, 90),
    },
    commonMistakes: avgErrors,
    progressVelocity: {
      averageDelta: deltas.length
        ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
        : null,
      positiveShare: deltas.length
        ? Math.round((deltas.filter((d) => d > 0).length / deltas.length) * 100)
        : null,
    },
  };

  return NextResponse.json(response);
}
