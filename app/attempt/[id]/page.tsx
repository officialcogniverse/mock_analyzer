"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/section-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { KpiRow } from "@/components/kpi-row";
import { PatternCard } from "@/components/pattern-card";
import { ActionChecklist } from "@/components/action-checklist";
import { useAttempt } from "@/lib/hooks/useAttempt";
import type { ActionState } from "@/lib/domain/types";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function AttemptReportPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = React.use(params);
  const { data, loading, error, refresh } = useAttempt(id);
  const [actionState, setActionState] = useState<ActionState[]>([]);

  React.useEffect(() => {
    if (data?.actionState) {
      setActionState(data.actionState);
    }
  }, [data?.actionState]);

  const report = data?.report;
  const attempt = data?.attempt;

  const kpis = useMemo(() => {
    if (!attempt || !report) return [];
    const completed = actionState.filter((row) => row.status === "completed").length;
    const totalActions = report.nextActions.length;
    const completionRate = totalActions ? Math.round((completed / totalActions) * 100) : 0;
    return [
      {
        label: "Signal quality",
        value: `${report.signalQuality.score}%`,
        hint: `Band: ${report.signalQuality.band}`,
      },
      {
        label: "Strategy confidence",
        value: `${report.confidence.score}%`,
        hint: `Band: ${report.confidence.band}`,
      },
      {
        label: "Action completion",
        value: `${completionRate}%`,
        hint: `${completed}/${totalActions} actions complete`,
      },
    ];
  }, [attempt, report, actionState]);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
        <SectionHeader
          eyebrow="Generate report"
          title="Building your attempt report"
          description="We are assembling insights, patterns, and next actions."
        />
        <LoadingState lines={8} />
      </main>
    );
  }

  if (error || !attempt || !report) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-12">
        <EmptyState
          title="Report missing"
          description={
            error || "We could not load this report. Try generating it again from the upload page."
          }
          action={<Button onClick={() => router.push("/")}>Back to upload</Button>}
        />
      </main>
    );
  }

  const limitedSignal = report.signalQuality.score < 50 || report.confidence.score < 45;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow="Report → Actions → Delta"
          title={`Attempt ${attempt.id.slice(-6)} report`}
          description={`Uploaded ${formatDate(attempt.createdAt)}. Complete your next actions before the next attempt.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/history">History</Link>
          </Button>
          <Button onClick={refresh} variant="ghost">
            Refresh
          </Button>
        </div>
      </div>

      {kpis.length ? <KpiRow items={kpis} /> : null}

      {limitedSignal ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full border-amber-300 bg-white">
              Limited signal
            </Badge>
            <p className="font-medium">We need a bit more data to sharpen this strategy.</p>
          </div>
          <p className="mt-2 text-amber-900/90">
            On your next upload, include sectional scores, attempts, accuracy, and timing notes. That will strengthen the delta and next actions.
          </p>
        </div>
      ) : null}

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Summary"
          title="What happened in this attempt"
          description="Keep this in mind as you execute the checklist."
        />
        <div className="rounded-3xl border bg-white p-6 text-base leading-7 text-slate-900">
          {report.summary}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Patterns"
          title="Execution patterns to fix"
          description="Patterns are your leverage points. Focus on the top ones first."
        />
        {report.patterns.length ? (
          <div className="grid gap-4">
            {report.patterns.map((pattern, index) => (
              <PatternCard key={pattern.id} pattern={pattern} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Patterns pending"
            description="We did not detect stable patterns yet. Complete the next actions and upload again to generate the delta."
            action={<Button onClick={() => router.push("/")}>Upload next attempt</Button>}
          />
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Next actions"
          title="Close the loop"
          description="Mark actions complete as you execute them. This powers your next delta."
        />
        <ActionChecklist
          attemptId={attempt.id}
          actions={report.nextActions}
          state={actionState}
          onStateChange={setActionState}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader
            eyebrow="Strategy"
            title="Your next mock script"
            description="Use this script during the next attempt."
          />
          <div className="rounded-3xl border bg-white p-6">
            {report.strategy.nextMockScript.length ? (
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-900">
                {report.strategy.nextMockScript.map((line, idx) => (
                  <li key={`script-${idx}`}>{line}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Script missing. Generate another report with more timing details for a stronger script.
              </p>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <SectionHeader
            eyebrow="Rules"
            title="Attempt rules"
            description="These rules keep you from repeating the same patterns."
          />
          <div className="rounded-3xl border bg-white p-6">
            {report.strategy.attemptRules.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-900">
                {report.strategy.attemptRules.map((rule, idx) => (
                  <li key={`rule-${idx}`}>{rule}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No attempt rules yet. Upload with more detail so the analyzer can infer pacing and decision rules.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Plan"
          title="How to prepare before the next attempt"
          description="Plan days and levers are optional. Use them when available."
        />
        {report.plan.days.length || report.plan.levers.length || report.plan.rules.length ? (
          <div className="rounded-3xl border bg-white p-6 space-y-4">
            {report.plan.days.length ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">Plan days</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {report.plan.days.map((day, idx) => (
                    <div key={`day-${idx}`} className="rounded-2xl border border-dashed p-3 text-sm">
                      <p className="font-medium text-slate-900">Day {day.day ?? idx + 1}</p>
                      {day.title ? <p className="text-xs text-muted-foreground">{day.title}</p> : null}
                      {day.focus ? <p className="mt-1 text-sm text-slate-900">{day.focus}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {report.plan.levers.length ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">Top levers</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.plan.levers.map((lever, idx) => (
                    <li key={`lever-${idx}`}>{lever.title || lever.detail || `Lever ${idx + 1}`}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {report.plan.rules.length ? (
              <div>
                <p className="text-sm font-semibold text-slate-900">If-then rules</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.plan.rules.map((rule, idx) => (
                    <li key={`plan-rule-${idx}`}>{rule}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="Plan not available"
            description="We can still improve. Execute the next actions and upload again to generate a richer plan."
            action={<Button onClick={() => router.push("/")}>Upload next attempt</Button>}
          />
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Delta"
          title="What changed since the last attempt"
          description="Delta connects the loop between attempts."
        />
        {data.deltaFromPrevious ? (
          <div className="rounded-3xl border bg-white p-6 space-y-3">
            <p className="text-sm text-slate-900">{data.deltaFromPrevious.summary}</p>
            {data.deltaFromPrevious.changes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
                {data.deltaFromPrevious.changes.map((change, idx) => (
                  <li key={`delta-${idx}`}>{change}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                We need another attempt to compute a meaningful delta. Complete your next actions and upload again.
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            title="Delta pending"
            description="Upload a second attempt after completing your checklist to unlock deltas and strategy improvement."
            action={<Button onClick={() => router.push("/")}>Upload next attempt</Button>}
          />
        )}
      </section>
    </main>
  );
}
