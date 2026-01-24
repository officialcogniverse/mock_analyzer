"use client";

import dynamic from "next/dynamic";
import { CalendarClock, MapPinned, Milestone, Share2 } from "lucide-react";

import { EmptyState } from "@/components/cogniverse/EmptyState";
import { NextBestActionRail } from "@/components/cogniverse/NextBestActionRail";
import { SectionHeader } from "@/components/cogniverse/SectionHeader";
import { ShareCard } from "@/components/cogniverse/ShareCard";
import { SkeletonCard } from "@/components/cogniverse/SkeletonCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import { planCompletion } from "@/lib/domain/selectors";
import { formatDate } from "@/lib/utils/format";

const PathwayMap = dynamic(() => import("@/components/cogniverse/PathwayMap").then((mod) => mod.PathwayMap), {
  ssr: false,
  loading: () => <SkeletonCard lines={6} className="min-h-[360px]" />,
});

export default function PlanPage() {
  const { state } = useCogniverse();
  const report = state.report;

  if (!report.plan.length) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-14 sm:px-6">
        <EmptyState
          title="Plan missing. We will generate a baseline plan."
          description="We use your next best actions to scaffold a day-by-day pathway with checkpoints."
          ctaLabel="Back to dashboard"
          ctaHref="/dashboard"
        />
      </main>
    );
  }

  const milestones = report.plan.filter((day) => day.milestone);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <SectionHeader
        title="Plan pathway"
        subtitle="Game-map clarity with coach-grade rigor. Finish the route, don't overthink it."
        action={
          <Button variant="outline" className="tap-scale rounded-full">
            <Share2 className="mr-2 h-4 w-4" aria-hidden />
            Share route
          </Button>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <PathwayMap plan={report.plan} actions={report.actions} />

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="surface-card flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-primary/15 bg-primary/10 text-primary">
                  <Milestone className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Milestones
                </Badge>
                <p className="text-sm text-muted-foreground">Proof that the plan is working.</p>
              </div>
              <div className="space-y-3">
                {milestones.map((day) => (
                  <div key={day.id} className="rounded-3xl border border-border/70 bg-background/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{day.milestone}</p>
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        {planCompletion(day)}%
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{day.focus}</p>
                    <p className="pt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {day.label} · {formatDate(day.date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <ShareCard variant="progress" report={report} />
          </div>
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-24">
          <NextBestActionRail actions={report.actions} sticky />
          <div className="surface-card flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
              Next mock window
            </div>
            <p className="text-sm text-muted-foreground">Planned for {state.intake.nextMockDays} days. Keep the last day light and sharp.</p>
            <Separator />
            <Button variant="outline" className="tap-scale rounded-2xl">
              <MapPinned className="mr-2 h-4 w-4" aria-hidden />
              Lock mock day
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}
