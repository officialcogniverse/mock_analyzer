"use client";

import * as React from "react";
import { toast } from "sonner";

import { UploadCard, type AnalyzeResult } from "@/components/upload/UploadCard";
import { NextBestActions } from "@/components/analysis/NextBestActions";
import { PlanPathway } from "@/components/analysis/PlanPathway";
import { InsightsSummary } from "@/components/analysis/InsightsSummary";
import { ProgressTracker } from "@/components/analysis/ProgressTracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Plan, RecommendationBundle } from "@/lib/schemas/workflow";

const examGoals = ["CAT", "JEE", "NEET", "UPSC", "Other"];

type RecommendationState = {
  recommendation: RecommendationBundle & { _id?: string };
  attempt: Record<string, any>;
  progressSummary: Record<string, any> | null;
  recentEvents: Array<Record<string, any>>;
};

export function AppDashboard() {
  const [profile, setProfile] = React.useState<any>(null);
  const [loadingLatest, setLoadingLatest] = React.useState(true);
  const [state, setState] = React.useState<RecommendationState | null>(null);
  const [savingTask, setSavingTask] = React.useState<string | null>(null);

  const [onboarding, setOnboarding] = React.useState({
    examGoal: "CAT",
    targetDate: "",
    weeklyHours: 6,
    baselineLevel: "",
    theme: "system",
  });

  React.useEffect(() => {
    async function loadProfile() {
      const res = await fetch("/api/user");
      const json = await res.json();
      if (json.ok) {
        setProfile(json.data);
        setOnboarding({
          examGoal: json.data.examGoal || "CAT",
          targetDate: json.data.targetDate || "",
          weeklyHours: json.data.weeklyHours ?? 6,
          baselineLevel: json.data.baselineLevel || "",
          theme: json.data.preferences?.theme || "system",
        });
      }
    }
    void loadProfile();
  }, []);

  React.useEffect(() => {
    async function loadLatest() {
      const res = await fetch("/api/recommendations/latest");
      const json = await res.json();
      if (json.ok && json.data.recommendation) {
        setState({
          recommendation: json.data.recommendation,
          attempt: json.data.attempt,
          progressSummary: json.data.progressSummary,
          recentEvents: json.data.recentEvents ?? [],
        });
      }
      setLoadingLatest(false);
    }
    void loadLatest();
  }, []);

  const handleSaveOnboarding = async () => {
    const res = await fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examGoal: onboarding.examGoal,
        targetDate: onboarding.targetDate || null,
        weeklyHours: Number(onboarding.weeklyHours) || 0,
        baselineLevel: onboarding.baselineLevel || null,
        onboardingCompleted: true,
        preferences: { theme: onboarding.theme },
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setProfile(json.data);
      toast.success("Profile updated");
    } else {
      toast.error(json.error?.message || "Unable to update profile");
    }
  };

  const handleAnalyzed = (result: AnalyzeResult) => {
    setState({
      recommendation: result.recommendation as RecommendationBundle,
      attempt: result.attempt,
      progressSummary: result.progressSummary ?? null,
      recentEvents: result.recentEvents ?? [],
    });
  };

  const updatePlanTask = (plan: Plan, taskId: string, status: string, note?: string) => ({
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      tasks: day.tasks.map((task) =>
        task.id === taskId
          ? { ...task, status: status as any, note: note ?? task.note }
          : task
      ),
    })),
  });

  const handleTaskUpdate = async (taskId: string, status: string, note?: string) => {
    if (!state?.recommendation?._id) return;
    setSavingTask(taskId);
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationId: state.recommendation._id,
        taskId,
        status,
        note,
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              recommendation: {
                ...prev.recommendation,
                plan: updatePlanTask(prev.recommendation.plan, taskId, status, note),
              },
              progressSummary: json.data.progressSummary ?? prev.progressSummary,
              recentEvents: json.data.recentEvents ?? prev.recentEvents,
            }
          : prev
      );
      toast.success("Progress updated");
    } else {
      toast.error(json.error?.message || "Unable to update task");
    }
    setSavingTask(null);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 pb-24 pt-8 sm:px-6 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Mock workflow</h1>
            <p className="text-sm text-muted-foreground">
              Upload → insights → next best actions → plan → progress.
            </p>
          </div>
          {profile && !profile.onboardingCompleted ? (
            <div className="rounded-2xl border border-border bg-background p-5">
              <h2 className="text-lg font-semibold">Quick onboarding</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us your goal so the plan stays on target.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Exam goal</Label>
                  <Select
                    value={onboarding.examGoal}
                    onValueChange={(value) => setOnboarding((prev) => ({ ...prev, examGoal: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {examGoals.map((goal) => (
                        <SelectItem key={goal} value={goal}>
                          {goal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target date (optional)</Label>
                  <Input
                    type="date"
                    value={onboarding.targetDate}
                    onChange={(event) =>
                      setOnboarding((prev) => ({ ...prev, targetDate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weekly hours</Label>
                  <Input
                    type="number"
                    min={0}
                    value={onboarding.weeklyHours}
                    onChange={(event) =>
                      setOnboarding((prev) => ({ ...prev, weeklyHours: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Baseline level (optional)</Label>
                  <Input
                    value={onboarding.baselineLevel}
                    onChange={(event) =>
                      setOnboarding((prev) => ({ ...prev, baselineLevel: event.target.value }))
                    }
                    placeholder="e.g., 65% accuracy"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select
                    value={onboarding.theme}
                    onValueChange={(value) => setOnboarding((prev) => ({ ...prev, theme: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={handleSaveOnboarding}>Save profile</Button>
              </div>
            </div>
          ) : null}
          <UploadCard onAnalyzed={handleAnalyzed} />
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Latest attempt</h2>
              {state?.attempt?.exam?.detected ? (
                <span className="text-xs text-muted-foreground">{state.attempt.exam.detected}</span>
              ) : null}
            </div>
            {loadingLatest ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : state ? (
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p className="text-foreground">
                  {state.attempt?.source?.type ? `Source: ${state.attempt.source.type}` : "Latest mock captured."}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-1">
                    Score: {state.attempt?.known?.score ?? "n/a"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    Accuracy: {state.attempt?.known?.accuracy ? `${state.attempt.known.accuracy}%` : "n/a"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    Persona: {state.attempt?.inferred?.persona ?? "steady"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                Upload a mock to generate your first workflow.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-background p-6">
            <h2 className="text-lg font-semibold">Next best actions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              3–5 moves that will move your next score the fastest.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {state?.recommendation?.nbas?.slice(0, 3).map((action: any) => (
                <div key={action.id} className="rounded-lg border border-border/60 p-3">
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.why}</p>
                </div>
              ))}
              {!state?.recommendation?.nbas?.length ? (
                <p className="text-sm text-muted-foreground">Analyze a mock to see actions.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className={cn("grid gap-6", state ? "lg:grid-cols-[1.2fr_0.8fr]" : "")}>
        {state ? (
          <>
            <div className="space-y-6">
              <InsightsSummary insights={state.recommendation.insights} />
              <NextBestActions actions={state.recommendation.nbas} />
            </div>
            <div className="space-y-6">
              <PlanPathway
                plan={state.recommendation.plan}
                onUpdate={handleTaskUpdate}
                savingTaskId={savingTask}
              />
              <ProgressTracker summary={state.progressSummary} recentEvents={state.recentEvents} />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Upload a mock to generate your plan.
          </div>
        )}
      </section>
    </main>
  );
}
