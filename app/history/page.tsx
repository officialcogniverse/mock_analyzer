"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight, BrainCircuit, History, Lightbulb, TrendingUp } from "lucide-react";

import { ConfidenceMeter } from "@/components/cogniverse/ConfidenceMeter";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { SkeletonCard } from "@/components/cogniverse/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import { buildAttemptTrend, buildConfidenceTrend } from "@/lib/domain/selectors";
import { formatDate, formatDelta } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const AttemptTrendChart = dynamic(
  () => import("@/components/cogniverse/charts/AttemptTrendChart").then((mod) => mod.AttemptTrendChart),
  {
    ssr: false,
    loading: () => <SkeletonCard lines={5} className="min-h-[340px]" />,
  },
);

const ConfidenceTrendChart = dynamic(
  () => import("@/components/cogniverse/charts/ConfidenceTrendChart").then((mod) => mod.ConfidenceTrendChart),
  {
    ssr: false,
    loading: () => <SkeletonCard lines={4} className="min-h-[280px]" />,
  },
);

export default function HistoryPage() {
  const { state } = useCogniverse();
  const report = state.report;
  const attemptTrend = buildAttemptTrend(report);
  const confidenceTrend = buildConfidenceTrend(report);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="History & progress"
        subtitle="Evidence over vibes. Track what changed and why it moved."
        action={
          <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
            <History className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            3 mocks tracked
          </Badge>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <div className="surface-card flex flex-col gap-5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Improvement trends</p>
                <h3 className="text-2xl font-semibold">Score, accuracy, and speed are moving together.</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                <TrendingUp className="h-4 w-4" aria-hidden />
                Upward drift
              </div>
            </div>
            <AttemptTrendChart data={attemptTrend} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="surface-card flex flex-col gap-4 p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowUpRight className="h-4 w-4 text-primary" aria-hidden />
                What changed since last mock
              </div>
              <div className="grid grid-cols-2 gap-3">
                <DeltaCard label="Accuracy" value={report.deltas.accuracy} />
                <DeltaCard label="Speed" value={report.deltas.speed} />
                <DeltaCard label="Risk" value={report.deltas.risk} tone="down" />
                <DeltaCard label="Consistency" value={report.deltas.consistency} />
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">Deltas are mock-to-mock signals. We use them to adjust the pathway and next best actions.</p>
            </div>
            <ConfidenceMeter value={report.strategy.confidence} mode="thermo" />
          </div>

          <div className="surface-card flex flex-col gap-5 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Strategy evolution</p>
              <h3 className="text-2xl font-semibold">How your strategy got smarter.</h3>
            </div>
            <div className="relative flex flex-col gap-4 pl-3">
              <div className="absolute left-5 top-2 h-[calc(100%-1rem)] w-0.5 bg-primary/20" aria-hidden />
              {report.strategyTimeline.map((item) => (
                <div key={item.id} className="relative flex gap-3 rounded-3xl border border-border/70 bg-background/80 p-4">
                  <div className="relative mt-1">
                    <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary">
                      <Lightbulb className="h-5 w-5" aria-hidden />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.label}</p>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {formatDelta(item.confidenceChange)} confidence
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.why}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{formatDate(item.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card flex flex-col gap-5 p-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Strategy confidence trend</p>
              <h3 className="text-2xl font-semibold">Confidence rises when strategy survives new mocks.</h3>
            </div>
            <ConfidenceTrendChart data={confidenceTrend} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <div className="surface-card flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BrainCircuit className="h-4 w-4 text-primary" aria-hidden />
              Attempts timeline
            </div>
            <div className="space-y-3">
              {report.attempts.map((attempt, index) => (
                <div key={attempt.id} className="rounded-2xl border border-border/70 bg-background/80 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Mock {index + 1}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(attempt.date)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Score {attempt.score} · Accuracy {attempt.accuracy}%</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card flex flex-col gap-4 p-5">
            <p className="text-sm font-medium text-muted-foreground">Persona & learning pattern</p>
            <div className="space-y-3">
              {report.personas.map((persona) => (
                <div key={persona.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{persona.label}</p>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {persona.confidence}%
                    </span>
                  </div>
                  <p className="pt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Why we think this</p>
                  <ul className="space-y-1 pt-2 text-sm text-muted-foreground">
                    {persona.why.map((reason) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

type DeltaCardProps = {
  label: string;
  value: number;
  tone?: "up" | "down";
};

function DeltaCard({ label, value, tone }: DeltaCardProps) {
  const isDown = tone === "down" || value < 0;

  return (
    <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold", isDown ? "text-emerald-500" : "text-primary")}>{formatDelta(value)}</p>
      <p className="text-xs text-muted-foreground">vs last mock</p>
    </div>
  );
}
