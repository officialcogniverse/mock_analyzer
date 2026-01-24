"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Goal, UploadCloud } from "lucide-react";

import { ShareCard } from "@/components/cogniverse/ShareCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCogniverse } from "@/lib/domain/mockData";
import type { GoalFocus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const goals: GoalFocus[] = ["Score", "Accuracy", "Speed", "Concepts"];

export default function LandingPage() {
  const router = useRouter();
  const { state, setIntake } = useCogniverse();
  const currentAttemptId = state.report.currentAttemptId;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIntake(state.intake);
    router.push(`/dashboard?attempt=${currentAttemptId}`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 pb-20 pt-12 sm:px-6 lg:px-10">
      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
            <Goal className="h-3.5 w-3.5" aria-hidden />
            Coach-grade loop closing
          </div>
          <div className="space-y-4">
            <h1 className="text-display max-w-2xl">Close the loop on every mock attempt.</h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Upload a scorecard or paste your attempt text. We generate actions + a plan. Signal quality improves with more detail.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
              Exam-agnostic (CAT/JEE/NEET/UPSC/etc.)
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
              <UploadCloud className="h-4 w-4 text-primary" aria-hidden />
              PDF + images supported
            </div>
          </div>
        </div>
        <div className="surface-card surface-glow flex flex-col gap-5 p-6 sm:p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Generate your coach report</h2>
            <p className="text-sm text-muted-foreground">Get a report you will actually want to screenshot.</p>
          </div>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="exam-label">
                Exam label (optional)
              </label>
              <Input
                id="exam-label"
                placeholder="e.g., CAT 2026"
                value={state.intake.examLabel}
                onChange={(event) => setIntake({ examLabel: event.target.value })}
                className="rounded-2xl"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Goal"
                value={state.intake.goal}
                onValueChange={(value) => setIntake({ goal: value as GoalFocus })}
                options={goals.map((goal) => ({ label: goal, value: goal }))}
              />
              <SelectField
                label="Next mock in"
                value={state.intake.nextMockDays}
                onValueChange={(value) => setIntake({ nextMockDays: value })}
                options={[
                  { label: "3 days", value: "3" },
                  { label: "7 days", value: "7" },
                  { label: "14 days", value: "14" },
                  { label: "21 days", value: "21" },
                  { label: "30+ days", value: "30+" },
                ]}
              />
              <SelectField
                label="Weekly hours"
                value={state.intake.weeklyHours}
                onValueChange={(value) => setIntake({ weeklyHours: value })}
                options={[
                  { label: "<10 hours", value: "<10" },
                  { label: "10–20 hours", value: "10-20" },
                  { label: "20–35 hours", value: "20-35" },
                  { label: "35+ hours", value: "35+" },
                ]}
              />
              <SelectField
                label="Biggest struggle"
                value={state.intake.biggestStruggle}
                onValueChange={(value) => setIntake({ biggestStruggle: value })}
                options={[
                  { label: "Running out of time", value: "Running out of time" },
                  { label: "Careless mistakes", value: "Careless" },
                  { label: "Concept gaps", value: "Concept gaps" },
                  { label: "Selection", value: "Selection" },
                  { label: "Stress", value: "Stress" },
                  { label: "Inconsistent", value: "Inconsistent" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Upload attempt</p>
              <div className="flex flex-col gap-3 rounded-[1.75rem] border border-dashed border-primary/35 bg-primary/5 p-5 text-sm text-muted-foreground">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Drop PDF or images here</p>
                    <p className="text-xs text-muted-foreground">UI only for now. We will plug in parsing hooks next.</p>
                  </div>
                  <Button type="button" variant="secondary" className="tap-scale rounded-full">
                    Choose files
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">or paste attempt text</p>
                  <Input className="rounded-2xl" placeholder="Paste your attempt breakdown here..." />
                </div>
              </div>
            </div>

            <Button type="submit" className="tap-scale mt-2 rounded-2xl text-sm font-semibold">
              Generate report
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </form>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="surface-card flex flex-col gap-4 p-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Why students keep sharing this</h2>
            <p className="text-sm text-muted-foreground">
              We don&apos;t just analyze. We prescribe. Every insight is structured to become a screenshot-ready coach card.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Signal quality",
                detail: "Clear confidence and assumptions",
              },
              {
                title: "Next best action",
                detail: "Time-boxed and evidence driven",
              },
              {
                title: "Pathway map",
                detail: "Metro-style plan you can follow",
              },
            ].map((item) => (
              <div key={item.title} className={cn("rounded-3xl border border-border/70 bg-background/80 p-4", "tap-scale transition hover:border-primary/40")}>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <ShareCard variant="summary" report={state.report} />
      </section>
    </main>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
};

function SelectField({ label, value, onValueChange, options }: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="rounded-2xl">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
