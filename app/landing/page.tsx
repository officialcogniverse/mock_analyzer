"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SectionHeader } from "@/components/section-header";
import { LoadingCard } from "@/components/loading-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EXAMS, type Exam } from "@/lib/exams";
import { ensureSession } from "@/lib/userClient";
import { NextBestActionRail } from "@/components/next-best-action-rail";
import { cn } from "@/lib/utils";
import {
  Upload,
  Target,
  Clock,
  Brain,
  FileText,
  Users,
  ShieldCheck,
  ClipboardCheck,
  CalendarClock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { ExamPatternChecklist } from "@/components/ExamPatternChecklist";
import { sampleNextActions } from "@/lib/sampleData";

type GoalUI = "percentile" | "accuracy" | "speed" | "weak_topics";
type GoalApi = "score" | "accuracy" | "speed" | "concepts";

type Struggle = "selection" | "time" | "concepts" | "careless" | "anxiety";

type UserDoc = {
  _id: string;
  displayName: string | null;
  examDefault: string | null;
  auth?: { email?: string | null };
  profile?: {
    preferredMockDay?: string | null;
    examAttempt?: string | null;
    focusArea?: string | null;
    studyGroup?: string | null;
  };
};

function mapGoalToApi(goal: GoalUI): GoalApi {
  if (goal === "percentile") return "score";
  if (goal === "weak_topics") return "concepts";
  return goal;
}

function mapStruggleToApi(struggle: Struggle) {
  return struggle;
}

function formatFileSize(file?: File | null) {
  if (!file) return "";
  const size = file.size / 1024;
  if (size < 1024) return `${Math.round(size)} KB`;
  return `${(size / 1024).toFixed(1)} MB`;
}

function formatAnalyzeError(message?: string) {
  const text = String(message || "").toLowerCase();
  if (text.includes("pdf")) {
    return "We couldn’t read that PDF. Try exporting again or upload a text copy.";
  }
  if (text.includes("blank") || text.includes("empty")) {
    return "The file looks blank. Upload a full scorecard or paste the text.";
  }
  if (text.includes("parse")) {
    return "We couldn’t parse that scorecard. Try the text paste option instead.";
  }
  return "We hit a snag generating your report. Please retry in a minute.";
}

export default function LandingPage() {
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [profileName, setProfileName] = useState("");
  const [preferredMockDay, setPreferredMockDay] = useState("");
  const [examAttempt, setExamAttempt] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [studyGroup, setStudyGroup] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInName, setSignInName] = useState("");
  const [signInExam, setSignInExam] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

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

  useEffect(() => {
    if (!sessionReady) return;
    let active = true;
    fetch("/api/user")
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const u = json?.user as UserDoc | null;
        setUser(u || null);
        setProfileName(u?.displayName || "");
        setPreferredMockDay(u?.profile?.preferredMockDay || "");
        setExamAttempt(u?.profile?.examAttempt || "");
        setFocusArea(u?.profile?.focusArea || "");
        setStudyGroup(u?.profile?.studyGroup || "");
        setSignInName(u?.displayName || "");
        setSignInExam(u?.examDefault || "");
        setAuthEmail(u?.auth?.email || "");
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, [sessionReady]);

  const [step, setStep] = useState(1);

  const [exam, setExam] = useState<Exam | null>(null);
  const [goal, setGoal] = useState<GoalUI | null>(null);
  const [struggle, setStruggle] = useState<Struggle | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [lastReportId, setLastReportId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedId = localStorage.getItem("cogniverse_last_report_id");
      if (storedId) setLastReportId(storedId);
    } catch {}
  }, []);

  const progress = useMemo(() => (step / 2) * 100, [step]);

  const displayName = user?.displayName || profileName || "Cogniverse Student";
  const examDefault = user?.examDefault || signInExam;

  const canGoNext = useMemo(() => {
    if (step === 1) return !!exam && !!goal && !!struggle;
    if (step === 2) return true;
    return false;
  }, [step, exam, goal, struggle]);

  const canAnalyze = useMemo(() => {
    return !!exam && !!goal && !!struggle && (text.trim().length > 40 || !!file);
  }, [exam, goal, struggle, text, file]);

  const choiceBtn = (active: boolean) => (active ? "default" : "outline");

  async function saveProfile() {
    if (!sessionReady) {
      toast.error("Session not ready. Please refresh once.");
      return;
    }
    setProfileSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: profileName,
          profile: {
            preferredMockDay,
            examAttempt,
            focusArea,
            studyGroup,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save profile");
      setUser(data.user || null);
      toast.success("Profile saved ✅");
    } catch (error: any) {
      toast.error(error?.message || "Profile save failed");
    } finally {
      setProfileSaving(false);
    }
  }

  async function signIn() {
    if (!authEmail || !authCode) {
      toast.error("Enter email + OTP to continue.");
      return;
    }
    if (!sessionReady) {
      toast.error("Session not ready. Please refresh once.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: authEmail,
          code: authCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "OTP verification failed");

      const profileRes = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: signInName,
          examDefault: signInExam,
        }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData?.error || "Profile update failed");

      setUser(profileData.user || data.user || null);
      setProfileName(profileData.user?.displayName || "");
      setSignInOpen(false);
      toast.success("Signed in ✅");
      router.push("/history");
    } catch (error: any) {
      toast.error(error?.message || "Sign-in failed");
    } finally {
      setOtpVerifying(false);
    }
  }

  async function sendOtp() {
    if (!authEmail) {
      toast.error("Enter your email first.");
      return;
    }
    if (!sessionReady) {
      toast.error("Session not ready. Please refresh once.");
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send", email: authEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send OTP");
      setDevOtp(data?.devCode || "");
      toast.success("OTP sent ✅ (check email or dev code)");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  }

  async function onAnalyze() {
    if (!canAnalyze || !exam || !goal || !struggle) return;

    if (!sessionReady) {
      toast.error("Session not ready. Please refresh once.");
      return;
    }

    setLoading(true);
    try {
      const intake = {
        goal: mapGoalToApi(goal),
        hardest: mapStruggleToApi(struggle),
        weekly_hours: "10-20" as const,
      };

      const form = new FormData();
      form.append("exam", exam);
      form.append("intake", JSON.stringify(intake));

      const trimmed = text.trim();
      if (trimmed) form.append("text", trimmed);

      if (file) form.append("file", file);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.detectedExam && typeof data.detectedExam === "string") {
          const detected = data.detectedExam as Exam;
          setExam(detected);
          toast.message(`Detected ${detected} scorecard — switched exam ✅`);
          return;
        }

        toast.error(formatAnalyzeError(data?.error));
        return;
      }

      try {
        if (typeof window !== "undefined" && data?.id) {
          localStorage.setItem("cogniverse_last_report_id", String(data.id));
          setLastReportId(String(data.id));
        }
      } catch {}

      toast.success("Report ready 🚀");
      router.push(`/report/${data.id}`);
    } catch {
      toast.error(formatAnalyzeError());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-8">
          <nav className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                CV
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Cogniverse</p>
                <p className="text-xs text-muted-foreground">
                  Mock analyzer for focused, student-first plans
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button variant="ghost" onClick={() => router.push("/history")}>
                History
              </Button>
              <Button variant="ghost" onClick={() => router.push("/report/sample")}>
                Sample report
              </Button>
              <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Sign in</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign in to sync your progress</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Email address</div>
                      <Input
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="student@cogniverse.ai"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">One-time passcode</div>
                      <div className="flex gap-2">
                        <Input
                          value={authCode}
                          onChange={(e) => setAuthCode(e.target.value)}
                          placeholder="6-digit code"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={sendOtp}
                          disabled={otpSending}
                        >
                          {otpSending ? "Sending..." : "Send code"}
                        </Button>
                      </div>
                      {devOtp ? (
                        <div className="text-xs text-muted-foreground">
                          Dev OTP: <span className="font-medium">{devOtp}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Your name</div>
                      <Input
                        value={signInName}
                        onChange={(e) => setSignInName(e.target.value)}
                        placeholder="e.g., Cogniverse Student"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Default exam</div>
                      <Input
                        value={signInExam}
                        onChange={(e) => setSignInExam(e.target.value)}
                        placeholder="CAT / JEE / NEET"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={signIn}
                      disabled={otpVerifying}
                      type="button"
                    >
                      {otpVerifying ? "Verifying..." : "Continue"}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      OTP sign-in keeps your history synced across devices.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </nav>

          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <Badge className="w-fit bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                New · Calm confidence in 5 minutes
              </Badge>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
                  Upload your mock. Get a plan that feels doable.
                </h1>
                <p className="text-base text-muted-foreground">
                  Mock Analyzer turns messy scorecards into a clear action plan, so you
                  know exactly what to fix next.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="gap-2" onClick={() => setStep(2)}>
                  Analyze my mock <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => router.push("/report/sample")}>
                  Preview report
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Fast clarity",
                    description: "Your top 3 fixes in under 2 mins.",
                    icon: <Sparkles className="h-4 w-4" />,
                  },
                  {
                    title: "Trust the data",
                    description: "We only use your mock for your plan.",
                    icon: <ShieldCheck className="h-4 w-4" />,
                  },
                  {
                    title: "Momentum",
                    description: "Daily tasks + streaks to stay on track.",
                    icon: <ClipboardCheck className="h-4 w-4" />,
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border bg-white p-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      {item.icon}
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-6 p-6">
                <SectionHeader
                  title="Analyze a mock"
                  description="Two quick steps. We’ll handle the rest."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                      Start over
                    </Button>
                  }
                />

                <div className="space-y-2">
                  <Progress value={progress} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Step {step} of 2</span>
                    <span className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Est. 3 min setup
                    </span>
                  </div>
                </div>

                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Target className="w-5 h-5" /> Choose your exam
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
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
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Brain className="w-5 h-5" /> Your next 2-week goal
                      </h3>
                      <div className="grid gap-2">
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
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Where do you lose marks?
                      </h3>
                      <div className="grid gap-2">
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

                    <details className="rounded-xl border bg-slate-50/70 p-4">
                      <summary className="cursor-pointer text-sm font-medium text-slate-900">
                        Advanced context (optional)
                      </summary>
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Preferred mock day
                            </label>
                            <Input
                              value={preferredMockDay}
                              onChange={(e) => setPreferredMockDay(e.target.value)}
                              placeholder="Saturday"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Exam attempt
                            </label>
                            <Input
                              value={examAttempt}
                              onChange={(e) => setExamAttempt(e.target.value)}
                              placeholder="1st attempt"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Focus area
                            </label>
                            <Input
                              value={focusArea}
                              onChange={(e) => setFocusArea(e.target.value)}
                              placeholder="VARC accuracy"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                              Study group
                            </label>
                            <Input
                              value={studyGroup}
                              onChange={(e) => setStudyGroup(e.target.value)}
                              placeholder="Cogniverse Cohort A"
                            />
                          </div>
                        </div>
                        <ExamPatternChecklist
                          exam={exam}
                          title="Exam pattern checklist"
                          subtitle="We align your plan to real exam format, timing, and marking."
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            onClick={saveProfile}
                            disabled={profileSaving}
                          >
                            {profileSaving ? "Saving..." : "Save preferences"}
                          </Button>
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Upload className="w-5 h-5" /> Upload your mock
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        PDF scorecard or pasted text works. We only use your mock to
                        generate your plan.
                      </p>
                    </div>

                    <div
                      className={cn(
                        "rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
                        isDragging
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 bg-white"
                      )}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDragging(false);
                        const dropped = event.dataTransfer.files?.[0];
                        if (dropped) setFile(dropped);
                      }}
                    >
                      <input
                        id="mock-upload"
                        type="file"
                        className="sr-only"
                        accept="application/pdf"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      <label htmlFor="mock-upload" className="cursor-pointer space-y-2">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium text-slate-900">
                          Drag & drop your PDF here, or click to upload
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF only · Best results under 10 MB
                        </p>
                      </label>
                      {file ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Selected: <span className="font-medium">{file.name}</span> · {formatFileSize(file)}
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Or paste scorecard text</div>
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
                      {loading ? "Analyzing..." : "Generate my plan"}
                    </Button>
                    {loading ? (
                      <LoadingCard lines={2} />
                    ) : null}
                    <div className="text-xs text-muted-foreground">
                      We never share your mock. Results stay tied to your account only.
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3 pt-2">
                  <Button
                    variant="ghost"
                    disabled={step === 1}
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                  >
                    Back
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={!canGoNext || step === 2}
                      onClick={() => setStep((current) => Math.min(2, current + 1))}
                    >
                      Next
                    </Button>
                    {lastReportId ? (
                      <Button onClick={() => router.push(`/report/${lastReportId}`)}>
                        Resume last report
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => router.push("/report/sample")}
                      >
                        View sample report
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Profile-first onboarding",
              description:
                "Capture exam targets, timing preferences, and study cadence in a structured profile.",
              icon: <Users className="h-5 w-5" />,
            },
            {
              title: "Verified activity log",
              description:
                "Every mock submission becomes a timeline entry with context and follow-ups.",
              icon: <ClipboardCheck className="h-5 w-5" />,
            },
            {
              title: "Secure data trail",
              description:
                "Signed-in students keep reports, notes, and pacing insights in one place.",
              icon: <ShieldCheck className="h-5 w-5" />,
            },
          ].map((item) => (
            <Card key={item.title} className="rounded-2xl border border-slate-200 bg-white">
              <CardContent className="space-y-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  {item.icon}
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardContent className="space-y-5 p-6">
              <SectionHeader
                title="Save your study profile"
                description="Optional, but it keeps your mock history and goals synced."
                action={
                  <Button variant="outline" size="sm" onClick={() => setSignInOpen(true)}>
                    Sign in to sync
                  </Button>
                }
              />
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-base font-semibold text-indigo-700">
                  {displayName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold">{displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {examDefault ? `${examDefault} · ` : ""}Target percentile 95+
                  </p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-3 text-sm">
                <div className="rounded-lg border bg-white px-3 py-2">
                  Target exam window: <span className="font-medium">Next 14 days</span>
                </div>
                <div className="rounded-lg border bg-white px-3 py-2">
                  Weekly study rhythm: <span className="font-medium">10–20 hours</span>
                </div>
                <div className="rounded-lg border bg-white px-3 py-2">
                  Coach: <span className="font-medium">Assigned · Priya S.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <NextBestActionRail
            actions={sampleNextActions}
            title="Next best actions"
            emptyMessage="Sample report shows your next best action."
            ctaLabel="Preview sample report"
            onCtaClick={() => router.push("/report/sample")}
          />
        </section>

        <footer className="flex flex-col gap-3 border-t pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© 2024 Cogniverse. Student analytics platform.</p>
          <div className="flex flex-wrap gap-4">
            <button type="button" className="hover:underline">
              Privacy
            </button>
            <button type="button" className="hover:underline">
              Terms
            </button>
            <button type="button" className="hover:underline">
              Contact support
            </button>
          </div>
        </footer>
      </div>
    </main>
  );
}
