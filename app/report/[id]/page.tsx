"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAttempt } from "@/lib/hooks/useAttempt";

function formatDate(value: any) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function asArray<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();

  // ✅ Next.js: params is a Promise in client components
  const { id } = React.use(params);

  const { data, loading, error } = useAttempt(id);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Building your report...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="text-sm text-destructive">{error || "Report unavailable."}</p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Back to dashboard
        </Button>
      </main>
    );
  }

  const attempt = (data as any)?.attempt;
  const recommendation = (data as any)?.recommendation;

  if (!attempt || !recommendation) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <p className="text-sm text-destructive">
          Report data is incomplete. Please regenerate your plan.
        </p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          Back to dashboard
        </Button>
      </main>
    );
  }

  const attemptId = String(attempt._id ?? attempt.id ?? "");
  const createdAt = attempt.createdAt ?? attempt.created_at ?? attempt.created ?? null;
  const examLabel =
    attempt?.exam?.detected ?? attempt?.exam?.label ?? attempt?.exam ?? "agnostic";

  // ✅ IMPORTANT: widen recommendation to any inside this adapter boundary
  const recAny: any = recommendation;

  // ✅ normalize fields from recommendation (support variants)
  const nbas = asArray<any>(recAny.nbas ?? recAny.next_actions ?? recAny.actions);
  const probes = asArray<any>(recAny.probes ?? recAny.drills);
  const planDays = asArray<any>(recAny.plan?.days ?? recAny.planDays);

  // ✅ strategy normalization WITHOUT TS errors
  const nextMockStrategyAny: any =
    recAny.nextMockStrategy ?? recAny.next_mock_strategy ?? recAny.strategy ?? {};

  const rules = asArray<string>(nextMockStrategyAny.rules);
  const timeCheckpoints = asArray<string>(
    nextMockStrategyAny.timeCheckpoints ?? nextMockStrategyAny.time_checkpoints
  );
  const skipPolicy = asArray<string>(
    nextMockStrategyAny.skipPolicy ?? nextMockStrategyAny.skip_policy
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Report
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Your next mock plan</h1>
        <p className="text-muted-foreground">
          Attempt {attemptId ? attemptId.slice(-6) : String(id).slice(-6)} · Uploaded{" "}
          {formatDate(createdAt)} · Exam: {String(examLabel)}
        </p>
      </section>

      <section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Next best actions</h2>
        <p className="text-sm text-muted-foreground">
          Execute the top actions before your next mock to tighten accuracy and pacing.
        </p>

        <div className="mt-4 grid gap-3">
          {nbas.length ? (
            nbas.map((nba: any, idx: number) => (
              <div key={nba.id ?? `${idx}`} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{nba.title ?? nba.name ?? "Action"}</p>
                  <span className="text-xs text-muted-foreground">
                    {nba.timeHorizon ?? nba.horizon ?? ""}
                  </span>
                </div>

                {nba.why ? (
                  <p className="mt-1 text-sm text-muted-foreground">{nba.why}</p>
                ) : null}

                {asArray<string>(nba.successCriteria ?? nba.success_criteria).length ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Success:{" "}
                    {asArray<string>(nba.successCriteria ?? nba.success_criteria).join(" · ")}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No actions were generated for this attempt. Try regenerating.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Drills & probes</h2>
        <p className="text-sm text-muted-foreground">
          Short drills to validate your improvement quickly.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {probes.length ? (
            probes.map((probe: any, idx: number) => (
              <div key={probe.id ?? `${idx}`} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{probe.title ?? "Probe"}</p>
                  <span className="text-xs text-muted-foreground">
                    {probe.durationMin ?? probe.duration_min ?? ""}{" "}
                    {probe.durationMin || probe.duration_min ? "min" : ""}
                  </span>
                </div>

                {probe.instructions ? (
                  <p className="mt-2 text-sm text-muted-foreground">{probe.instructions}</p>
                ) : null}

                {probe.successCheck ?? probe.success_check ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Success check: {probe.successCheck ?? probe.success_check}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No probes were generated. That’s okay—focus on the actions above.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Next-mock strategy script</h2>
        <p className="text-sm text-muted-foreground">Keep this visible during the next attempt.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rules
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {rules.length ? rules.map((r, i) => <li key={`r-${i}`}>{r}</li>) : (
                <li>Stay calm. Follow your plan.</li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Time checkpoints
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {timeCheckpoints.length ? timeCheckpoints.map((r, i) => <li key={`t-${i}`}>{r}</li>) : (
                <li>Set 2 checkpoints: mid-section + 10 min left.</li>
              )}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skip policy
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {skipPolicy.length ? skipPolicy.map((r, i) => <li key={`s-${i}`}>{r}</li>) : (
                <li>Skip anything that exceeds your time budget.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Plan snapshot</h2>
        <p className="text-sm text-muted-foreground">
          Your day-wise plan derived from the actions above.
        </p>

        <div className="mt-4 grid gap-3">
          {planDays.length ? (
            planDays.map((day: any, idx: number) => (
              <div key={day.dayIndex ?? day.day_index ?? `${idx}`} className="rounded-2xl border p-4">
                <p className="text-sm font-medium">
                  Day {day.dayIndex ?? day.day_index ?? idx + 1}:{" "}
                  {day.title ?? day.label ?? "Focus day"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {asArray<any>(day.tasks).length} tasks
                </p>
              </div>
            ))
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Plan not available. Still—execute the actions above for 3–5 days and retry.
            </p>
          )}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Button onClick={() => router.push("/")}>Upload another mock</Button>
      </div>
    </main>
  );
}
