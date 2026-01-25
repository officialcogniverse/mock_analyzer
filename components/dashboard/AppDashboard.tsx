"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { UploadCard, type UploadResult } from "@/components/upload/UploadCard";
import { NextBestActions } from "@/components/analysis/NextBestActions";
import { PlanPathway } from "@/components/analysis/PlanPathway";
import { Checklist } from "@/components/analysis/Checklist";
import { NotesPanel } from "@/components/analysis/NotesPanel";
import { BotWidget } from "@/components/bot/BotWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const examGoals = ["CAT", "JEE", "NEET", "UPSC", "Other"];

export function AppDashboard() {
  const searchParams = useSearchParams();
  const [profile, setProfile] = React.useState<any>(null);
  const [upload, setUpload] = React.useState<UploadResult | null>(null);
  const [analysis, setAnalysis] = React.useState<any>(null);
  const [analysisId, setAnalysisId] = React.useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = React.useState<any>(null);
  const [nudges, setNudges] = React.useState<Array<{ id: string; message: string }>>([]);
  const [loadingAnalyze, setLoadingAnalyze] = React.useState(false);
  const [loadingLatest, setLoadingLatest] = React.useState(true);

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
      const targetAnalysisId = searchParams.get("analysisId");
      const endpoint = targetAnalysisId ? `/api/analysis/${targetAnalysisId}` : "/api/analysis/latest";
      const res = await fetch(endpoint);
      const json = await res.json();
      if (json.ok) {
        setAnalysis(json.data.analysis);
        setAnalysisId(json.data.analysisId);
        setAnalysisMeta({
          attempt: json.data.attempt,
          upload: json.data.upload,
        });
      }
      setLoadingLatest(false);
    }
    void loadLatest();
  }, [searchParams]);

  React.useEffect(() => {
    async function loadNudges() {
      const res = await fetch("/api/nudges");
      const json = await res.json();
      if (json.ok) setNudges(json.data);
    }
    void loadNudges();
  }, []);

  const postEvent = async (eventName: string, payload?: Record<string, any>) => {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName, payload }),
    });
  };

  React.useEffect(() => {
    if (upload?.uploadId) {
      void postEvent("upload_attempt", { uploadId: upload.uploadId });
    }
  }, [upload?.uploadId]);

  React.useEffect(() => {
    if (analysisId) {
      void postEvent("generate_plan", { analysisId });
      void postEvent("view_actions", { analysisId });
    }
  }, [analysisId]);

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

  const handleAnalyze = async () => {
    if (!upload) return;
    setLoadingAnalyze(true);
    try {
      void postEvent("analyze_attempt", { uploadId: upload.uploadId });
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: upload.uploadId,
          intake: {
            examGoal: onboarding.examGoal,
            weeklyHours: Number(onboarding.weeklyHours) || 0,
            baselineLevel: onboarding.baselineLevel,
          },
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setAnalysis(json.data.analysis);
        setAnalysisId(json.data.analysisId);
        setAnalysisMeta({
          attempt: {
            attemptId: json.data.attemptId,
            createdAt: new Date(),
            exam: json.data.analysis?.signalsUsed?.examGoal ?? null,
          },
          upload: { filename: upload.filename ?? null, extractedTextSnippet: upload.extractedTextSnippet ?? null },
        });
        toast.success("Analysis ready");
      } else {
        toast.error(json.error?.message || "Analysis failed");
      }
    } finally {
      setLoadingAnalyze(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-4 pb-24 pt-8 sm:px-6 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Upload → analyze → execute. Your full mock loop is live here.
            </p>
          </div>
          {nudges.length > 0 ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-medium">Nudge</p>
              <p className="text-muted-foreground">{nudges[0].message}</p>
            </div>
          ) : null}
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
          <UploadCard onUploaded={setUpload} />
          {upload ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">Upload ready</p>
              <p className="text-muted-foreground">
                {upload.extractedTextSnippet
                  ? `“${upload.extractedTextSnippet}…”`
                  : "Text extraction complete."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleAnalyze} disabled={loadingAnalyze}>
                  {loadingAnalyze ? "Analyzing..." : "Analyze"}
                </Button>
                {upload.extraction?.status === "needs_intake" ? (
                  <span className="text-xs text-muted-foreground">
                    Add intake details above for a stronger plan.
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-background p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Latest analysis</h2>
              {analysisMeta?.attempt?.exam ? (
                <span className="text-xs text-muted-foreground">{analysisMeta.attempt.exam}</span>
              ) : null}
            </div>
            {loadingLatest ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : analysis ? (
              <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                <p className="text-foreground">{analysis.summary}</p>
                {analysis.warnings?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    {analysis.warnings[0]}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2 py-1">
                    Pace: {analysis.signalsUsed?.paceBand || "n/a"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    Accuracy: {analysis.signalsUsed?.accuracyBand || "n/a"}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1">
                    Baseline: {analysis.signalsUsed?.baselineLevel || "n/a"}
                  </span>
                </div>
                {analysisId ? (
                  <Button asChild size="sm">
                    <Link href={`/app?analysisId=${analysisId}`}>Open analysis</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-muted-foreground">
                Upload a mock to generate your first analysis.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-background p-6">
            <h2 className="text-lg font-semibold">Next best actions</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Follow the top actions and keep your streak alive.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {analysis?.nba?.slice(0, 3).map((action: any) => (
                <div key={action.id} className="rounded-lg border border-border/60 p-3">
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.reason}</p>
                </div>
              ))}
              {!analysis?.nba?.length ? (
                <p className="text-sm text-muted-foreground">Analyze a mock to see actions.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-6">
            <h2 className="text-lg font-semibold">Nudge</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {nudges.length ? nudges[0].message : "Complete one action today to keep momentum."}
            </p>
          </div>
          <BotWidget />
        </div>
      </section>

      <section className={cn("grid gap-6", analysis ? "lg:grid-cols-[1.2fr_0.8fr]" : "")}>
        {analysis ? (
          <>
            <div className="space-y-6">
              <NextBestActions actions={analysis.nba} />
              <Checklist actions={analysis.nba} analysisId={analysisId} />
            </div>
            <div className="space-y-6">
              <PlanPathway plan={analysis.plan} />
              <NotesPanel actions={analysis.nba} analysisId={analysisId} />
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
