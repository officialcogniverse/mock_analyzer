"use client";

import type { AnalyzeResponse, NextBestAction } from "@/lib/contracts";
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

export function ReportView({ analysis, loading }: ReportViewProps) {
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
                  onClick={() => emitEvent("action_started", { actionId: action.id })}
                >
                  Start
                </button>
                <button
                  type="button"
                  className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200 hover:border-emerald-400"
                  onClick={() => emitEvent("action_completed", { actionId: action.id })}
                >
                  Complete
                </button>
                <button
                  type="button"
                  className="rounded-full border border-muted-foreground/30 px-3 py-1 text-muted-foreground hover:border-muted-foreground"
                  onClick={() => emitEvent("action_skipped", { actionId: action.id })}
                >
                  Skip
                </button>
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
