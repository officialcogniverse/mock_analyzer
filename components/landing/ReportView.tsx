"use client";

import { useMemo, useState } from "react";
import type { AnalyzeResponse, NextBestAction, StateSnapshot } from "@/lib/contracts";
import { emitEvent } from "@/lib/clientEvents";

type ReportViewProps = {
  analysis: AnalyzeResponse | null;
  loading: boolean;
};

const statusBadge: Record<NextBestAction["difficulty"], string> = {
  easy: "bg-emerald-500/10 text-emerald-200",
  medium: "bg-amber-400/10 text-amber-200",
  hard: "bg-rose-400/10 text-rose-200",
};

const STORAGE_KEYS = {
  lastReport: "cv.lastReport.v1",
  lastStateSnapshot: "cv.lastStateSnapshot.v1",
};

export function ReportView({ analysis, loading }: ReportViewProps) {
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(analysis?.stateSnapshot ?? null);

  const errorSummary = useMemo(() => {
    if (!snapshot) return null;
    const facts = snapshot.facts ?? {};
    const signals = snapshot.signals ?? {};
    const dominantErrorType = facts["mode2.dominantErrorType"];
    const counts = Object.entries(signals)
      .filter(([key, value]) => key.startsWith("errors.") && key.endsWith(".count") && typeof value === "number")
      .map(([key, value]) => ({
        label: key.replace("errors.", "").replace(".count", ""),
        value: value as number,
      }))
      .sort((a, b) => b.value - a.value);
    const timePressure = Boolean(signals["timePressure.proxy"]);

    if (!dominantErrorType && counts.length === 0 && !timePressure) return null;
    return { dominantErrorType, counts, timePressure };
  }, [snapshot]);

  const persistSnapshot = (nextSnapshot: StateSnapshot) => {
    setSnapshot(nextSnapshot);
    try {
      localStorage.setItem(STORAGE_KEYS.lastStateSnapshot, JSON.stringify(nextSnapshot));
      if (analysis) {
        localStorage.setItem(
          STORAGE_KEYS.lastReport,
          JSON.stringify({ ...analysis, stateSnapshot: nextSnapshot })
        );
      }
    } catch {
      // ignore
    }
  };

  const updateActionStatus = (actionId: string, status: "started" | "completed" | "skipped") => {
    if (!snapshot) return;
    const actionStatus = (snapshot.facts.actionStatus as Record<string, unknown>) ?? {};
    const nextSnapshot: StateSnapshot = {
      ...snapshot,
      facts: {
        ...snapshot.facts,
        actionStatus: {
          ...actionStatus,
          [actionId]: {
            status,
            ts: new Date().toISOString(),
          },
        },
      },
      lastUpdated: new Date().toISOString(),
    };
    persistSnapshot(nextSnapshot);
  };

  const updatePlanStepStatus = (
    stepId: string,
    status: "started" | "completed" | "skipped"
  ) => {
    if (!snapshot) return;
    const keyBase = `plan.step.${stepId}`;
    const nextSnapshot: StateSnapshot = {
      ...snapshot,
      facts: {
        ...snapshot.facts,
        [`${keyBase}.status`]: status,
        [`${keyBase}.updatedAt`]: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
    };
    persistSnapshot(nextSnapshot);
  };

  const actionStatus = (snapshot?.facts?.actionStatus as Record<string, { status?: string }> | undefined) ?? {};
  const stepStatusMap = useMemo(() => {
    if (!snapshot?.facts) return {};
    const entries = Object.entries(snapshot.facts)
      .filter(([key]) => key.startsWith("plan.step.") && key.endsWith(".status"))
      .map(([key, value]) => [key.replace("plan.step.", "").replace(".status", ""), value]);
    return Object.fromEntries(entries) as Record<string, string>;
  }, [snapshot]);

  if (loading) {
    return (
      <section className="surface-card space-y-4 p-6">
        <div className="h-6 w-1/3 rounded-full bg-muted" />
        <div className="h-4 w-full rounded-full bg-muted" />
        <div className="h-4 w-5/6 rounded-full bg-muted" />
        <div className="h-4 w-2/3 rounded-full bg-muted" />
        <p className="text-xs text-muted-foreground">Analyzing your mock…</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className="surface-card p-6 text-sm text-muted-foreground">
        Upload or paste a mock scorecard to generate your report.
      </section>
    );
  }

  if (!analysis.ok) {
    return (
      <section className="surface-card space-y-3 p-6 text-sm">
        <p className="text-sm font-semibold text-destructive">
          {analysis.error?.code ?? "ANALYZE_FAILED"}
        </p>
        <p className="text-muted-foreground">
          {analysis.error?.message ?? "We couldn’t analyze that input yet."}
        </p>
        {analysis.error?.action ? (
          <p className="text-xs text-muted-foreground">{analysis.error.action}</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {errorSummary ? (
        <div className="surface-card space-y-2 p-6">
          <h3 className="text-base font-semibold">Error drivers</h3>
          {errorSummary.dominantErrorType ? (
            <p className="text-sm text-muted-foreground">
              Top error driver:{" "}
              <span className="font-semibold text-foreground">{String(errorSummary.dominantErrorType)}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {errorSummary.counts.slice(0, 2).map((entry) => (
              <span key={entry.label} className="rounded-full bg-muted/40 px-3 py-1">
                {entry.label}: {entry.value}
              </span>
            ))}
            {errorSummary.timePressure ? (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">
                Time pressure detected
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {analysis.warnings.length ? (
        <div className="surface-card border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Heads up</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="surface-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">Next Best Actions</h3>
            <p className="text-sm text-muted-foreground">
              Start with one action today and mark it when done.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Source: {analysis.meta.source.toUpperCase()} · {analysis.meta.extractedChars} chars
          </p>
        </div>

        <div className="space-y-4">
          {analysis.nextBestActions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{action.title}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-3 py-1 ${statusBadge[action.difficulty]}`}>
                    {action.difficulty}
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
                    {action.estimatedImpact} impact
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{action.why}</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">When:</span>{" "}
                  {action.instructions.when}
                </p>
                <p>
                  <span className="font-semibold text-foreground">What:</span>{" "}
                  {action.instructions.what}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Stop:</span>{" "}
                  {action.instructions.stoppingCondition}
                </p>
                <p>
                  <span className="font-semibold text-foreground">Success:</span>{" "}
                  {action.instructions.successCriteria}
                </p>
                <p className="text-xs">
                  Duration: {action.instructions.durationMin} min · Category: {action.category}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-full border border-primary/40 px-3 py-1 text-primary hover:border-primary"
                  onClick={() => {
                    updateActionStatus(action.id, "started");
                    emitEvent("action_started", { actionId: action.id });
                  }}
                >
                  Start
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:border-emerald-400"
                  onClick={() => {
                    updateActionStatus(action.id, "completed");
                    emitEvent("action_completed", { actionId: action.id });
                  }}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className="rounded-full border border-muted-foreground/30 px-3 py-1 text-muted-foreground hover:border-muted-foreground"
                  onClick={() => {
                    updateActionStatus(action.id, "skipped");
                    emitEvent("action_skipped", { actionId: action.id });
                  }}
                >
                  Skip
                </button>
                {actionStatus[action.id]?.status ? (
                  <span className="rounded-full bg-muted/40 px-3 py-1 text-muted-foreground">
                    {actionStatus[action.id]?.status}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-card space-y-4 p-6">
        <h3 className="text-lg font-semibold">
          {analysis.executionPlan.horizonDays}-Day Execution Plan
        </h3>
        <div className="space-y-4">
          {analysis.executionPlan.days.map((day) => (
            <div key={`day-${day.day}`} className="rounded-2xl border border-border/70 p-4">
              <p className="text-sm font-semibold">
                Day {day.day}: {day.theme}
              </p>
              <p className="text-xs text-muted-foreground">{day.confidenceNote}</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {day.steps.length ? (
                  day.steps.map((step) => (
                    <div key={step.id} className="rounded-xl bg-muted/30 px-3 py-2">
                      <p className="font-medium text-foreground">
                        {step.title} · {step.timeboxMin} min
                      </p>
                      <p className="text-xs text-muted-foreground">{step.instructions}</p>
                      <p className="text-xs text-muted-foreground">{step.successCriteria}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          className="rounded-full border border-primary/40 px-3 py-1 text-primary hover:border-primary"
                          onClick={() => {
                            updatePlanStepStatus(step.id, "started");
                            emitEvent("plan_step_started", { stepId: step.id });
                          }}
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:border-emerald-400"
                          onClick={() => {
                            updatePlanStepStatus(step.id, "completed");
                            emitEvent("plan_step_completed", { stepId: step.id });
                          }}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-muted-foreground/30 px-3 py-1 text-muted-foreground hover:border-muted-foreground"
                          onClick={() => {
                            updatePlanStepStatus(step.id, "skipped");
                            emitEvent("plan_step_skipped", { stepId: step.id });
                          }}
                        >
                          Skip
                        </button>
                        {stepStatusMap[step.id] ? (
                          <span className="rounded-full bg-muted/40 px-3 py-1 text-muted-foreground">
                            {stepStatusMap[step.id]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Keep this day light and repeat your top action.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
