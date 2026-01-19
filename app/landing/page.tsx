"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ensureSession } from "@/lib/userClient";
import { Upload, Target, Clock, Brain, FileText } from "lucide-react";

type Exam = "CAT" | "NEET" | "JEE";
type Goal = "percentile" | "accuracy" | "speed" | "weak_topics";
type Struggle = "selection" | "time" | "concepts" | "careless" | "anxiety";

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
  const [goal, setGoal] = useState<Goal | null>(null);
  const [struggle, setStruggle] = useState<Struggle | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const progress = useMemo(() => (step / 4) * 100, [step]);

  const canGoNext = useMemo(() => {
    if (step === 1) return !!exam;
    if (step === 2) return !!goal;
    if (step === 3) return !!struggle;
    if (step === 4) return true;
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
        goal: goal === "percentile" ? "score" : goal,
        hardest:
          struggle === "selection"
            ? "selection"
            : struggle === "time"
            ? "time"
            : struggle === "concepts"
            ? "concepts"
            : struggle === "careless"
            ? "careless"
            : "anxiety",
        weekly_hours: "10-20",
      };

      const form = new FormData();
      form.append("exam", exam);
      form.append("intake", JSON.stringify(intake));
      form.append("text", text);
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
              Turn your mock into a clear 14-day improvement plan
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => router.push("/history")}
            >
              View my timeline
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/dashboard")}
            >
              View my dashboard
            </Button>
          </div>



          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground text-right">
              Step {step} of 4
            </p>
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Target className="w-5 h-5" /> Choose your exam
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <Button variant={choiceBtn(exam === "CAT")} onClick={() => setExam("CAT")}>
                  CAT
                </Button>
                <Button variant={choiceBtn(exam === "NEET")} onClick={() => setExam("NEET")}>
                  NEET
                </Button>
                <Button variant={choiceBtn(exam === "JEE")} onClick={() => setExam("JEE")}>
                  JEE
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Brain className="w-5 h-5" /> Your goal for next 14 days
              </h2>
              <div className="grid gap-3">
                <Button variant={choiceBtn(goal === "percentile")} onClick={() => setGoal("percentile")}>
                  Improve percentile 🚀
                </Button>
                <Button variant={choiceBtn(goal === "accuracy")} onClick={() => setGoal("accuracy")}>
                  Improve accuracy 🎯
                </Button>
                <Button variant={choiceBtn(goal === "speed")} onClick={() => setGoal("speed")}>
                  Improve speed ⚡
                </Button>
                <Button variant={choiceBtn(goal === "weak_topics")} onClick={() => setGoal("weak_topics")}>
                  Strengthen weak topics 📚
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5" /> Where do you feel you lose marks?
              </h2>
              <div className="grid gap-3">
                <Button variant={choiceBtn(struggle === "selection")} onClick={() => setStruggle("selection")}>
                  Poor question selection
                </Button>
                <Button variant={choiceBtn(struggle === "time")} onClick={() => setStruggle("time")}>
                  Time pressure
                </Button>
                <Button variant={choiceBtn(struggle === "concepts")} onClick={() => setStruggle("concepts")}>
                  Concept gaps
                </Button>
                <Button variant={choiceBtn(struggle === "careless")} onClick={() => setStruggle("careless")}>
                  Silly mistakes
                </Button>
                <Button variant={choiceBtn(struggle === "anxiety")} onClick={() => setStruggle("anxiety")}>
                  Anxiety / panic
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
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

              <Button onClick={onAnalyze} disabled={!canAnalyze || loading} className="w-full">
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
              disabled={!canGoNext || step === 4}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
