"use client";

import type { AnalysisResult } from "@/lib/engine/schemas";

type ReportViewProps = {
  analysis: AnalysisResult | null;
  loading: boolean;
};

const dataQualityTone: Record<AnalysisResult["confidence"]["dataQuality"], string> = {
  low: "bg-destructive/15 text-destructive",
  medium: "bg-amber-100/70 text-amber-700",
  high: "bg-emerald-100/70 text-emerald-700",
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

  return (
    <section className="space-y-6">
      <div className="surface-glow p-6">
        <h3 className="text-lg font-semibold">Summary</h3>
        <p className="text-muted mt-2">{analysis.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="surface-card space-y-4 p-6">
          <h3 className="text-lg font-semibold">Top Errors</h3>
          <div className="space-y-3">
            {analysis.topErrors.map((errorItem, idx) => (
              <div key={`${errorItem.title}-${idx}`} className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{errorItem.title}</p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                    Severity {errorItem.severity}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{errorItem.whyItHappens}</p>
                <p className="mt-2 text-sm font-medium text-foreground">{errorItem.fix}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card space-y-4 p-6">
          <h3 className="text-lg font-semibold">Next Best Actions</h3>
          <div className="space-y-3">
            {analysis.nextBestActions.map((action, idx) => (
              <div key={`${action.title}-${idx}`} className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">
                    {action.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{action.reason}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{action.timeMinutes} min</span>
                  <span>Difficulty {action.difficulty}/5</span>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {action.checklist.map((step, stepIdx) => (
                    <li key={`${action.title}-step-${stepIdx}`}>{step}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface-card space-y-4 p-6">
        <h3 className="text-lg font-semibold">{analysis.plan.horizonDays}-Day Study Plan</h3>
        <div className="space-y-4">
          {analysis.plan.days.map((day) => (
            <div key={`day-${day.day}`} className="rounded-2xl border border-border/70 p-4">
              <p className="text-sm font-semibold">
                Day {day.day}: {day.focus}
              </p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {day.tasks.map((task, idx) => (
                  <div key={`${day.day}-${idx}`} className="rounded-xl bg-muted/40 px-3 py-2">
                    <p className="font-medium text-foreground">
                      {task.title} · {task.minutes} min
                    </p>
                    <p className="text-xs text-muted-foreground">{task.method}</p>
                    <p className="text-xs text-muted-foreground">{task.expectedOutcome}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-card space-y-4 p-6">
          <h3 className="text-lg font-semibold">Motivation Reset</h3>
          <p className="text-sm font-medium text-foreground">{analysis.motivation.currentStateLabel}</p>
          <p className="text-sm text-muted-foreground">{analysis.motivation.microPepTalk}</p>
          <p className="text-sm text-muted-foreground">{analysis.motivation.routineAdvice}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {analysis.motivation.environmentTweaks.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Supportive study guidance only — not medical or therapeutic advice.
          </p>
        </div>

        <div className="surface-card space-y-4 p-6">
          <h3 className="text-lg font-semibold">Confidence & Inputs</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Data quality</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${dataQualityTone[analysis.confidence.dataQuality]}`}
            >
              {analysis.confidence.dataQuality}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Missing inputs</p>
            {analysis.confidence.missingInputs.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {analysis.confidence.missingInputs.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">All key intake fields captured.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
