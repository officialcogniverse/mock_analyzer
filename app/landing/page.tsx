"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { EXAMS, type Exam } from "@/lib/exams";
import { ensureSession } from "@/lib/userClient";
import { Upload, Target, Clock, Brain, FileText } from "lucide-react";

// UI-level goal choices (what user clicks)
type GoalUI = "percentile" | "accuracy" | "speed" | "weak_topics";

// API-level goal choices (what backend zod expects)
type GoalApi = "score" | "accuracy" | "speed" | "concepts";

type Struggle = "selection" | "time" | "concepts" | "careless" | "anxiety";

function mapGoalToApi(goal: GoalUI): GoalApi {
  if (goal === "percentile") return "score";
  if (goal === "weak_topics") return "concepts";
  // "accuracy" | "speed" are already valid API values
  return goal;
}

function mapStruggleToApi(struggle: Struggle) {
  // backend expects hardest: selection|time|concepts|careless|anxiety
  return struggle;
}

export default function LandingPage() {
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    ensureSession()
      .then(() => {
        if (isMounted) setSessionReady(true);
      })
      .catch((error) => {
        toast.error(error?.message || "Could not start session.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [step, setStep] = useState(1);

  const [exam, setExam] = useState<Exam | null>(null);
  const [goal, setGoal] = useState<GoalUI | null>(null);
  const [struggle, setStruggle] = useState<Struggle | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // Journey hint: if we have a last report id saved locally, show a CTA
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const x = localStorage.getItem("cogniverse_last_report_id");
      if (x) setLastReportId(x);
    } catch {}
  }, []);

  const progress = useMemo(() => (step / 2) * 100, [step]);

  const canGoNext = useMemo(() => {
    if (step === 1) return !!exam && !!goal && !!struggle;
    if (step === 2) return true;
    return false;
  }, [step, exam, goal, struggle]);

  const canAnalyze = useMemo(() => {
    return !!exam && !!goal && !!struggle && (text.trim().length > 40 || !!file);
  }, [exam, goal, struggle, text, file]);

  const choiceBtn = (active: boolean) => (active ? "default" : "outline");

  async function onAnalyze() {
    if (!canAnalyze || !exam || !goal || !struggle) return;

    if (!sessionReady) {
      toast.error("Session not ready. Please refresh once.");
      return;
    }

    setLoading(true);
    try {
      const intake = {
        goal: mapGoalToApi(goal), // ✅ FIXED mapping
        hardest: mapStruggleToApi(struggle),
        weekly_hours: "10-20" as const,
      };

      const form = new FormData();
      form.append("exam", exam);
      form.append("intake", JSON.stringify(intake));

      // keep clean payload
      const trimmed = text.trim();
      if (trimmed) form.append("text", trimmed);

      if (file) form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        // ✅ Auto-switch exam if server detected mismatch
        if (data?.detectedExam && typeof data.detectedExam === "string") {
          const detected = data.detectedExam as Exam;
          setExam(detected);
          toast.message(`Detected ${detected} scorecard — switched exam ✅`);
          return;
        }

        toast.error(data?.error || "Analysis failed");
        return;
      }

      // Save journey pointer
      try {
        if (typeof window !== "undefined" && data?.id) {
          localStorage.setItem("cogniverse_last_report_id", String(data.id));
          setLastReportId(String(data.id));
        }
      } catch {}

      toast.success("Report ready 🚀");
      router.push(`/report/${data.id}`);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <Card className="w-full max-w-2xl rounded-2xl shadow-lg">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">Cogniverse</h1>
            <p className="text-muted-foreground">
              Turn your mock into a clear improvement plan (built for the next mock)
            </p>
          </div>

          {/* Journey CTA (minimal distraction) */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <Button variant="secondary" onClick={() => router.push("/history")}>
              Continue my journey →
            </Button>

            {lastReportId ? (
              <button
                type="button"
                onClick={() => router.push(`/report/${lastReportId}`)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Resume last report
              </button>
            ) : (
              <div className="text-xs text-muted-foreground">
                Tip: analyze 2–3 mocks to unlock stronger learning behavior signals.
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-right">
              Step {step} of 2
            </p>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5" /> Choose your exam
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {EXAMS.map((item) => (
                    <Button
                      key={item}
                      variant={choiceBtn(exam === item)}
                      onClick={() => setExam(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5" /> Your goal for next 14 days
                </h2>
                <div className="grid gap-3">
                  <Button
                    variant={choiceBtn(goal === "percentile")}
                    onClick={() => setGoal("percentile")}
                  >
                    Improve percentile 🚀
                  </Button>
                  <Button
                    variant={choiceBtn(goal === "accuracy")}
                    onClick={() => setGoal("accuracy")}
                  >
                    Improve accuracy 🎯
                  </Button>
                  <Button
                    variant={choiceBtn(goal === "speed")}
                    onClick={() => setGoal("speed")}
                  >
                    Improve speed ⚡
                  </Button>
                  <Button
                    variant={choiceBtn(goal === "weak_topics")}
                    onClick={() => setGoal("weak_topics")}
                  >
                    Strengthen weak topics 📚
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5" /> Where do you feel you lose marks?
                </h2>
                <div className="grid gap-3">
                  <Button
                    variant={choiceBtn(struggle === "selection")}
                    onClick={() => setStruggle("selection")}
                  >
                    Poor question selection
                  </Button>
                  <Button
                    variant={choiceBtn(struggle === "time")}
                    onClick={() => setStruggle("time")}
                  >
                    Time pressure
                  </Button>
                  <Button
                    variant={choiceBtn(struggle === "concepts")}
                    onClick={() => setStruggle("concepts")}
                  >
                    Concept gaps
                  </Button>
                  <Button
                    variant={choiceBtn(struggle === "careless")}
                    onClick={() => setStruggle("careless")}
                  >
                    Silly mistakes
                  </Button>
                  <Button
                    variant={choiceBtn(struggle === "anxiety")}
                    onClick={() => setStruggle("anxiety")}
                  >
                    Anxiety / panic
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5" /> Upload your mock result
              </h2>

              <div className="rounded-xl border bg-white p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Upload PDF (optional)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Or paste scorecard/mock text</div>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your mock result text here"
                  className="min-h-[140px]"
                />
              </div>

              <Button
                onClick={onAnalyze}
                disabled={!canAnalyze || loading}
                className="w-full"
              >
                {loading ? "Analyzing..." : "Analyze & Generate Plan 🚀"}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="ghost"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Back
            </Button>
            <Button
              disabled={!canGoNext || step === 2}
              onClick={() => setStep((s) => Math.min(2, s + 1))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
