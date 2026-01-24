"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SectionHeader } from "@/components/section-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { PatternCard } from "@/components/pattern-card";
import { ActionChecklist } from "@/components/action-checklist";
import { useAttempt } from "@/lib/hooks/useAttempt";
import type { ActionState, ReportAction, ReportPlanTask } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

function formatDate(value: string | null | undefined, timezone?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, timezone ? { timeZone: timezone } : undefined);
}

function formatShortDate(value: string | null | undefined, timezone?: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, timezone ? { timeZone: timezone } : undefined);
}

function riskBand(signalQuality: "low" | "medium" | "high") {
  if (signalQuality === "high") return { label: "Low risk", tone: "secondary" as const };
  if (signalQuality === "low") return { label: "High risk", tone: "destructive" as const };
  return { label: "Watch risk", tone: "outline" as const };
}

function consistencyScore(actions: ReportAction[], stateMap: Map<string, ActionState>) {
  if (!actions.length) return null;
  const completed = actions.filter((action) => stateMap.get(action.id)?.status === "completed").length;
  const rate = Math.round((completed / actions.length) * 100);
  return Math.max(5, Math.min(99, rate));
}

function getTodayTasks(planTasks: ReportPlanTask[], stateMap: Map<string, ActionState>) {
  return planTasks.map((task, idx) => {
    const linked = task.action_id ? stateMap.get(task.action_id) : null;
    const done = linked?.status === "completed";
    return {
      id: `${task.action_id || task.title}-${idx}`,
      title: task.title,
      duration: task.duration_min,
      note: task.note,
      done,
    };
  });
}

function extractAccuracy(metricValue?: string) {
  if (!metricValue) return null;
  const match = metricValue.match(/(\d{1,3})/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

export default function AttemptReportPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = React.use(params);
  const { data, loading, error, refresh } = useAttempt(id);
  const [actionState, setActionState] = useState<ActionState[]>([]);
  const [history, setHistory] = useState<Array<{ id: string; created_at: string; accuracy_pct: number | null }>>([]);

  useEffect(() => {
    if (!data?.action_state) return;
    const timer = setTimeout(() => setActionState(data.action_state), 0);
    return () => clearTimeout(timer);
  }, [data?.action_state]);

  useEffect(() => {
    const exam = data?.attempt?.exam;
    if (!exam) return;
    let active = true;
    fetch(`/api/attempts?exam=${encodeURIComponent(exam)}&limit=12`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const attempts = Array.isArray(json?.attempts) ? json.attempts : [];
        const mapped = attempts.map((row: any) => ({
          id: String(row.id || ""),
          created_at: String(row.created_at || row.createdAt || ""),
          accuracy_pct: Number.isFinite(Number(row.accuracy_pct)) ? Number(row.accuracy_pct) : null,
        }));
        setHistory(mapped);
      })
      .catch(() => {
        if (active) setHistory([]);
      });
    return () => {
      active = false;
    };
  }, [data?.attempt?.exam]);

  const report = data?.report;
  const attempt = data?.attempt;
  const profile = data?.profile || null;

  const stateMap = useMemo(() => new Map(actionState.map((row) => [row.action_id, row])), [actionState]);

  const statsRow = useMemo(() => {
    if (!report) return [] as Array<{ label: string; value: string; hint: string }>;
    const risk = riskBand(report.signal_quality);
    const consistency = consistencyScore(report.next_actions, stateMap);
    const items = [
      {
        label: "Confidence",
        value: `${report.confidence}%`,
        hint: report.signal_quality === "low" ? "Signal quality: low" : "Coach confidence",
      },
      {
        label: "Risk",
        value: risk.label,
        hint: `Signal quality: ${report.signal_quality}`,
      },
    ];
    if (consistency !== null) {
      items.push({
        label: "Consistency",
        value: `${consistency}%`,
        hint: "Based on action completion",
      });
    }
    return items;
  }, [report, stateMap]);

  const limitedSignal = report?.signal_quality === "low" || (report?.confidence ?? 0) < 50;

  const heroGreeting = useMemo(() => {
    const name = profile?.displayName?.trim();
    if (name) return `${name}, here’s your next move.`;
    return "Here’s your next move.";
  }, [profile?.displayName]);


  const dayOne = report?.plan?.days?.[0];
  const todayTasks = dayOne ? getTodayTasks(dayOne.tasks || [], stateMap) : [];

  const accuracyTrend = useMemo(() => {
    if (!history.length) return [] as Array<{ id: string; label: string; value: number }>;
    const ordered = [...history].reverse();
    return ordered
      .map((row, idx) => {
        if (row.accuracy_pct != null) {
          return {
            id: row.id,
            label: `Mock ${idx + 1}`,
            value: row.accuracy_pct,
          };
        }
        return null;
      })
      .filter(Boolean) as Array<{ id: string; label: string; value: number }>;
  }, [history]);


  const accuracyMetric = attempt?.metrics?.find((metric) =>
    metric.label.toLowerCase().includes("accuracy")
  );
  const attemptAccuracy = extractAccuracy(accuracyMetric?.value);

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8">
        <SectionHeader
          eyebrow="Upload → Report → Actions"
          title="Building your coach report"
          description="We are assembling patterns, next actions, and your day-wise execution plan."
        />
        <LoadingState lines={10} />
      </main>
    );
  }

  if (error || !attempt || !report) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-12">
        <EmptyState
          title="Report missing"
          description={
            error ||
            "We could not load this report. Regenerate it from the upload page to restore your plan."
          }
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push("/")}>Regenerate report</Button>
              <Button variant="outline" onClick={() => router.push("/history")}>History</Button>
            </div>
          }
        />
      </main>
    );
  }

  const nextMockDateLabel = formatShortDate(profile?.nextMockDate, profile?.timezone || undefined);
  const uploadedAtLabel = formatDate(attempt.created_at, profile?.timezone || undefined);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-gradient-to-br from-indigo-50 via-white to-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader
                eyebrow="Coach report"
                title={heroGreeting}
                description={`Attempt ${attempt.id.slice(-6)} · Uploaded ${uploadedAtLabel}`}
              />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-indigo-200 bg-indigo-50 text-indigo-700">
                  Confidence {report.confidence}%
                </Badge>
                <Badge variant={report.signal_quality === "low" ? "destructive" : "secondary"} className="rounded-full">
                  Signal {report.signal_quality}
                </Badge>
              </div>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700">{report.summary}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-slate-900 text-white">Primary bottleneck</Badge>
              <span className="text-sm font-medium text-slate-900">{report.primary_bottleneck}</span>
              {profile?.goal ? (
                <Badge variant="outline" className="rounded-full">Goal: {profile.goal}</Badge>
              ) : null}
              {profile?.nextMockDate ? (
                <Badge variant="outline" className="rounded-full">Next mock: {nextMockDateLabel}</Badge>
              ) : null}
            </div>

            {statsRow.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {statsRow.map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-white/80 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.hint}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/history">History</Link>
              </Button>
              <Button variant="ghost" onClick={refresh}>Refresh</Button>
              <Button onClick={() => router.push("/")}>Upload next mock</Button>
            </div>
          </section>

          {limitedSignal ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full border-amber-300 bg-white">
                  Signal quality: Low
                </Badge>
                <p className="font-medium">We are still giving you a full baseline plan.</p>
              </div>
              {report.followups.length ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
                    Quick follow-ups to sharpen your next report
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-amber-900/90">
                    {report.followups.map((followup) => (
                      <li key={followup.id}>
                        {followup.question}
                        {followup.type === "single" && followup.options?.length
                          ? ` (${followup.options.join(" / ")})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {accuracyTrend.length ? (
            <section className="space-y-3">
              <SectionHeader
                eyebrow="Trend"
                title="Accuracy trend across attempts"
                description="If accuracy is flat, prioritize probes + next actions before adding new topics."
              />
              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-end gap-2">
                  {accuracyTrend.map((point) => (
                    <div key={point.id} className="flex w-full flex-col items-center gap-1">
                      <div className="text-[10px] text-muted-foreground">{point.value}%</div>
                      <div
                        className="w-full rounded-t-xl bg-indigo-500/80"
                        style={{ height: `${Math.max(12, point.value)}px` }}
                      />
                      <div className="text-[10px] text-muted-foreground">{point.label}</div>
                    </div>
                  ))}
                </div>
                {attemptAccuracy !== null ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Latest attempt accuracy (from extracted metrics): {attemptAccuracy}%.
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Patterns"
              title="Evidence-backed patterns to fix"
              description="Treat these as the root causes. The plan below is built to counter them."
            />
            <div className="grid gap-4">
              {report.patterns.slice(0, 6).map((pattern, index) => (
                <PatternCard key={pattern.id} pattern={pattern} index={index} />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Next actions"
              title="Your top 3 actions"
              description="Execute these before the next mock. Mark them done as you complete them."
            />
            <ActionChecklist
              attemptId={attempt.id}
              actions={report.next_actions}
              state={actionState}
              onStateChange={setActionState}
            />
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Day-wise plan"
              title={`${report.plan.days.length}-day plan before the next mock`}
              description="Each day is designed to reinforce the same decision rules until they stick."
            />
            <div className="grid gap-3">
              {report.plan.days.map((day) => (
                <div key={day.day_index} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Day {day.day_index}: {day.label}
                      </p>
                      <p className="text-xs text-muted-foreground">Focus: {day.focus}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {day.tasks.reduce((sum, task) => sum + task.duration_min, 0)} min
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {day.tasks.map((task, idx) => {
                      const linked = task.action_id ? stateMap.get(task.action_id) : null;
                      const done = linked?.status === "completed";
                      return (
                        <div
                          key={`${day.day_index}-${idx}`}
                          className={cn(
                            "rounded-xl border p-3 text-sm",
                            done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-slate-900">{task.title}</p>
                            <span className="text-xs text-muted-foreground">{task.duration_min}m</span>
                          </div>
                          {task.note ? (
                            <p className="mt-1 text-xs text-muted-foreground">{task.note}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Probe pack"
              title="Mini drills to validate improvement"
              description="Run these probes to confirm the bottleneck is actually shrinking."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {report.probes.map((probe) => (
                <div key={probe.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{probe.title}</p>
                    <Badge variant="secondary" className="rounded-full">
                      {probe.duration_min} min
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{probe.instructions}</p>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium text-slate-700">Success check</p>
                  <p className="text-xs text-muted-foreground">{probe.success_check}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Next mock strategy"
              title="Attempt rules + checkpoints + skip policy"
              description="Use this script live in the next mock. Treat it like exam-day code."
            />
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Rules
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.next_mock_strategy.rules.map((rule, idx) => (
                    <li key={`rule-${idx}`}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time checkpoints
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.next_mock_strategy.time_checkpoints.map((checkpoint, idx) => (
                    <li key={`checkpoint-${idx}`}>{checkpoint}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Skip policy
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.next_mock_strategy.skip_policy.map((rule, idx) => (
                    <li key={`skip-${idx}`}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Overall exam strategy"
              title="Weekly cadence that compounds"
              description="This is the meta-loop: plan, execute, probe, and upload again."
            />
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Weekly rhythm
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.overall_exam_strategy.weekly_rhythm.map((item, idx) => (
                    <li key={`weekly-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Revision loop
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.overall_exam_strategy.revision_loop.map((item, idx) => (
                    <li key={`revision-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Mock schedule
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-900">
                  {report.overall_exam_strategy.mock_schedule.map((item, idx) => (
                    <li key={`mock-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader
              eyebrow="Delta"
              title="What changed since the last attempt"
              description="Use delta to verify that your actions are actually shifting outcomes."
            />
            {data.delta_from_previous ? (
              <div className="rounded-3xl border bg-white p-6 space-y-3 shadow-sm">
                <p className="text-sm text-slate-900">{data.delta_from_previous.summary}</p>
                {data.delta_from_previous.changes.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
                    {data.delta_from_previous.changes.map((change, idx) => (
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
                description="Upload a second attempt after completing your checklist to compare deltas and strategy improvement."
                action={<Button onClick={() => router.push("/")}>Upload next attempt</Button>}
              />
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Today’s tasks</p>
                <p className="text-xs text-muted-foreground">Derived from Day 1 of your plan.</p>
              </div>
              <Badge variant="outline" className="rounded-full">
                {todayTasks.reduce((sum, task) => sum + task.duration, 0)} min
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              {todayTasks.length ? (
                todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      task.done ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <span className="text-xs text-muted-foreground">{task.duration}m</span>
                    </div>
                    {task.note ? (
                      <p className="mt-1 text-xs text-muted-foreground">{task.note}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your day-wise plan is ready. Start with the first day’s tasks.
                </p>
              )}
            </div>
          </section>

          <ActionChecklist
            attemptId={attempt.id}
            actions={report.next_actions}
            state={actionState}
            onStateChange={setActionState}
            title="Action rail"
            subtitle="Keep this open while you work through the plan."
            dense
          />
        </aside>
      </div>
    </main>
  );
}
