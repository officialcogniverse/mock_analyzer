"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAttempt } from "@/lib/hooks/useAttempt";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;
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

  const { attempt, recommendation } = data;
  const examLabel = attempt.exam?.detected ?? "agnostic";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Report</p>
        <h1 className="text-3xl font-semibold tracking-tight">Your next mock plan</h1>
        <p className="text-muted-foreground">
          Attempt {String(attempt._id).slice(-6)} · Uploaded {formatDate(attempt.createdAt)} · Exam: {examLabel}
        </p>
      </section>

      <section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Next best actions</h2>
        <p className="text-sm text-muted-foreground">
          Execute the top actions before your next mock to tighten accuracy and pacing.
        </p>
        <div className="mt-4 grid gap-3">
          {recommendation.nbas.map((nba) => (
            <div key={nba.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{nba.title}</p>
                <span className="text-xs text-muted-foreground">{nba.timeHorizon}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{nba.why}</p>
              <p className="mt-2 text-xs text-muted-foreground">Success: {nba.successCriteria.join(" · ")}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Drills & probes</h2>
        <p className="text-sm text-muted-foreground">Short drills to validate your improvement quickly.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recommendation.probes.map((probe) => (
            <div key={probe.id} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{probe.title}</p>
                <span className="text-xs text-muted-foreground">{probe.durationMin} min</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{probe.instructions}</p>
              <p className="mt-2 text-xs text-muted-foreground">Success check: {probe.successCheck}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Next-mock strategy script</h2>
        <p className="text-sm text-muted-foreground">Keep this visible during the next attempt.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rules</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {recommendation.nextMockStrategy.rules.map((rule, idx) => (
                <li key={`rule-${idx}`}>{rule}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Time checkpoints</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {recommendation.nextMockStrategy.timeCheckpoints.map((rule, idx) => (
                <li key={`checkpoint-${idx}`}>{rule}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skip policy</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {recommendation.nextMockStrategy.skipPolicy.map((rule, idx) => (
                <li key={`skip-${idx}`}>{rule}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Plan snapshot</h2>
        <p className="text-sm text-muted-foreground">Your day-wise plan derived from the actions above.</p>
        <div className="mt-4 grid gap-3">
          {recommendation.plan.days.map((day) => (
            <div key={day.dayIndex} className="rounded-2xl border p-4">
              <p className="text-sm font-medium">Day {day.dayIndex}: {day.title}</p>
              <p className="text-xs text-muted-foreground">{day.tasks.length} tasks</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Button onClick={() => router.push("/")}>Upload another mock</Button>
      </div>
    </main>
  );
}
