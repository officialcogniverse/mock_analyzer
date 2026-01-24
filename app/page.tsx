"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/section-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { ensureSession } from "@/lib/userClient";
import { useAttempts } from "@/lib/hooks/useAttempts";
import type { AttemptBundle } from "@/lib/domain/types";

type Goal = "score" | "accuracy" | "speed" | "concepts";
type Struggle = "selection" | "time" | "concepts" | "careless" | "anxiety" | "consistency";

type AnalyzeResponse = AttemptBundle & { id?: string };

const GOALS: Array<{ id: Goal; label: string; hint: string }> = [
  { id: "score", label: "Score", hint: "Improve overall performance" },
  { id: "accuracy", label: "Accuracy", hint: "Reduce mistakes" },
  { id: "speed", label: "Speed", hint: "Finish more questions" },
  { id: "concepts", label: "Concepts", hint: "Fix weak foundations" },
];

const STRUGGLES: Array<{ id: Struggle; label: string }> = [
  { id: "time", label: "Running out of time" },
  { id: "careless", label: "Careless mistakes" },
  { id: "concepts", label: "Concept gaps" },
  { id: "selection", label: "Poor question selection" },
  { id: "anxiety", label: "Stress/anxiety" },
  { id: "consistency", label: "Inconsistent performance" },
];

function weeklyHoursFromMinutes(minutes: number) {
  const weeklyHours = (minutes * 7) / 60;
  if (weeklyHours < 10) return "<10" as const;
  if (weeklyHours < 20) return "10-20" as const;
  if (weeklyHours < 35) return "20-35" as const;
  return "35+" as const;
}

export default function HomePage() {
  const router = useRouter();
  const { attempts, loading: attemptsLoading, refresh: refreshAttempts } = useAttempts(8);

  const [exam, setExam] = useState("");
  const [goal, setGoal] = useState<Goal>("score");
  const [struggle, setStruggle] = useState<Struggle>("time");
  const [nextMockDate, setNextMockDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState(45);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const weeklyHours = useMemo(() => weeklyHoursFromMinutes(dailyMinutes), [dailyMinutes]);
  const canSubmit = useMemo(() => text.trim().length > 20 || files.length > 0, [text, files]);

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Paste your attempt text or upload a scorecard to continue.");
      return;
    }

    setSubmitting(true);
    try {
      await ensureSession();

      const intake = {
        goal,
        hardest: struggle,
        weekly_hours: weeklyHours,
        next_mock_date: nextMockDate || undefined,
        daily_minutes: String(dailyMinutes),
      };

      let res: Response;
      if (files.length) {
        const form = new FormData();
        form.append("exam", exam || "AUTO");
        form.append("intake", JSON.stringify(intake));
        form.append("text", text);
        files.forEach((file) => form.append("files", file));
        res = await fetch("/api/analyze", { method: "POST", body: form });
      } else {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ exam: exam || "AUTO", intake, text }),
        });
      }

      const json = (await res.json().catch(() => null)) as AnalyzeResponse | null;
      if (!res.ok) {
        throw new Error(json && "error" in json ? (json as any).error : "Failed to analyze attempt.");
      }

      const attemptId = json?.attempt?.id || json?.id;
      if (!attemptId) {
        throw new Error("Report generated but attempt id was missing.");
      }

      toast.success("Report ready. Focus on your next actions.");
      await refreshAttempts();
      router.push(`/attempt/${attemptId}`);
    } catch (err: any) {
      toast.error(err?.message || "Could not generate report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <SectionHeader
        eyebrow="Upload → Report → Actions"
        title="Close the loop on every mock attempt"
        description="Upload your attempt, get a report, complete the next actions, and track improvement on the next upload."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Exam label</p>
                <Input
                  value={exam}
                  onChange={(event) => setExam(event.target.value)}
                  placeholder="CAT, JEE, NEET, GMAT..."
                />
                <p className="text-xs text-muted-foreground">Used for grouping attempts. Leave blank for auto-detect.</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Daily study minutes</p>
                <Input
                  type="number"
                  min={15}
                  max={240}
                  value={dailyMinutes}
                  onChange={(event) => setDailyMinutes(Number(event.target.value || 45))}
                />
                <p className="text-xs text-muted-foreground">Mapped to weekly hours: {weeklyHours}.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Primary goal</p>
              <div className="grid gap-3 md:grid-cols-2">
                {GOALS.map((item) => {
                  const active = goal === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setGoal(item.id)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        active ? "border-slate-900 bg-slate-900 text-white" : "bg-white hover:border-slate-400"
                      }`}
                    >
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className={`text-xs ${active ? "text-slate-100" : "text-muted-foreground"}`}>{item.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Biggest struggle from the last attempt</p>
              <div className="flex flex-wrap gap-2">
                {STRUGGLES.map((item) => {
                  const active = struggle === item.id;
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={active ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => setStruggle(item.id)}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Next mock date (optional)</p>
                <Input type="date" value={nextMockDate} onChange={(event) => setNextMockDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">Upload scorecard</p>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
                <p className="text-xs text-muted-foreground">PDFs and images are supported. You can also paste plain text below.</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900">Attempt text</p>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste your sectional scores, accuracy, attempts, and any notes from the mock..."
                className="min-h-[180px]"
              />
              <p className="text-xs text-muted-foreground">The report is only as good as the signal. Include scores, accuracy, and timing if possible.</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">
                  Weekly hours: {weeklyHours}
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  Flow: Upload → Report → Actions → Delta
                </Badge>
              </div>
              <Button type="button" size="lg" disabled={submitting || !canSubmit} onClick={handleSubmit}>
                {submitting ? "Generating report..." : "Generate report"}
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Recent attempts"
            title="Pick up where you left off"
            description="Every attempt should lead to a report and a checklist. Jump back into the loop."
          />

          {attemptsLoading ? (
            <LoadingState lines={6} />
          ) : attempts.length ? (
            <div className="space-y-3">
              {attempts.map((attempt) => (
                <Card key={attempt.id} className="rounded-2xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Attempt {attempt.id.slice(-6)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.createdAt).toLocaleString()} · {attempt.sourceType}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => router.push(`/attempt/${attempt.id}`)}>
                      Open report
                    </Button>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/history")}>
                View full history
              </Button>
            </div>
          ) : (
            <EmptyState
              title="No attempts yet"
              description="Upload your first attempt to generate a report and start tracking progress."
              action={
                <Button type="button" onClick={handleSubmit} disabled={submitting || !canSubmit}>
                  Generate report
                </Button>
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
