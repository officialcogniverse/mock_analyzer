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
} from "lucide-react";
import { ExamPatternChecklist } from "@/components/ExamPatternChecklist";
import { sampleNextActions } from "@/lib/sampleData";

type GoalUI = "percentile" | "accuracy" | "speed" | "weak_topics";
type GoalApi = "score" | "accuracy" | "speed" | "concepts";

type Struggle = "selection" | "time" | "concepts" | "careless" | "anxiety";

type ActivityItem = {
  title: string;
  detail: string;
  timestamp: string;
  tag: string;
};

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

const ACTIVITY_FEED: ActivityItem[] = [
  {
    title: "Quant drill: Linear equations",
    detail: "21/30 correct · 88% speed target",
    timestamp: "Today · 9:30 AM",
    tag: "Accuracy",
  },
  {
    title: "Verbal mock · RC set 2",
    detail: "Marked 5 doubtful, review pending",
    timestamp: "Yesterday · 6:10 PM",
    tag: "Review",
  },
  {
    title: "Full-length CAT mock",
    detail: "Score 82 · percentile 91",
    timestamp: "Aug 20 · 8:15 AM",
    tag: "Milestone",
  },
];

function mapGoalToApi(goal: GoalUI): GoalApi {
  if (goal === "percentile") return "score";
  if (goal === "weak_topics") return "concepts";
  return goal;
}

function mapStruggleToApi(struggle: Struggle) {
  return struggle;
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

        toast.error(data?.error || "Analysis failed");
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
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8">
        <header className="flex flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
                CV
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Cogniverse Portal</p>
                <p className="text-xs text-muted-foreground">
                  Student profiles · mock analytics · activity logs
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button variant="ghost" onClick={() => router.push("/history")}
>
                Activity
              </Button>
              <Button variant="ghost">Programs</Button>
              <Button variant="ghost">Support</Button>
              <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Sign in</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign in to your portal</DialogTitle>
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
                      {otpVerifying ? "Verifying..." : "Continue to dashboard"}
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      OTP sign-in keeps your history synced across devices.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </nav>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Badge className="w-fit bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                New · Student profile and activity flow
              </Badge>
              <h1 className="text-4xl font-bold text-slate-900">
                A real student portal that tracks every mock, section, and goal.
              </h1>
              <p className="text-base text-muted-foreground">
                Give learners a signed-in experience, a personalized profile, and a clear
                workflow from intake → analysis → activity logging. Every section below
                mirrors a production-ready student dashboard.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="gap-2" onClick={() => router.push("/report/sample")}>
                  View sample report <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => router.push("/history")}
>
                  Browse activity feed
                </Button>
              </div>
            </div>

            <Card className="rounded-2xl border border-indigo-100 bg-white/80 shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-500">
                    Student Sign-In
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Keep progress synced across devices
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Students can save profiles, activity history, and analytics context.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Student email
                    </label>
                    <Input
                      placeholder="student@cogniverse.ai"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      One-time passcode
                    </label>
                    <Input
                      placeholder="6-digit code"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                    />
                    {devOtp ? (
                      <div className="text-xs text-muted-foreground">
                        Dev OTP: <span className="font-medium">{devOtp}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={sendOtp} disabled={otpSending}>
                    {otpSending ? "Sending..." : "Send code"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setSignInOpen(true)}>
                    Verify & continue
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Passwordless sign-in keeps onboarding friction low while logging every
                  mock attempt.
                </p>
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
                "Each mock submission becomes a timeline entry with context and follow-ups.",
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
          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-500">Student Profile</p>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      Profile that looks real
                    </h2>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
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
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Profile settings</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        Student name
                      </label>
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Cogniverse Student"
                      />
                    </div>
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
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={saveProfile} disabled={profileSaving}>
                      {profileSaving ? "Saving..." : "Save profile"}
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/history")}>
                      Go to dashboard
                    </Button>
                    <Button variant="outline">Request coach review</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Activity log</h3>
                    <p className="text-sm text-muted-foreground">
                      Every mock, drill, and review gets logged automatically.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push("/history")}>
                    View full log
                  </Button>
                </div>
                <div className="space-y-3">
                  {ACTIVITY_FEED.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border bg-white px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                        <Badge variant="outline">{item.tag}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.timestamp}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-indigo-500">Mock workflow</p>
                    <h2 className="text-2xl font-semibold text-slate-900">
                      Guided mock analysis flow
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Clear steps, back buttons, and an audit trail so students always
                      know where they are in the workflow.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    Start over
                  </Button>
                </div>

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
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Target className="w-5 h-5" /> Choose your exam
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
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
                        <Brain className="w-5 h-5" /> Goal for the next 14 days
                      </h3>
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
                      <h3 className="text-base font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5" /> Where do you lose marks?
                      </h3>
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

                    <ExamPatternChecklist
                      exam={exam}
                      title="Exam pattern checklist"
                      subtitle="We align your plan to the real exam format, timing, and marking."
                    />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Upload className="w-5 h-5" /> Upload your mock result
                    </h3>

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
                      <div className="text-sm font-medium">
                        Or paste scorecard/mock text
                      </div>
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
                      <Button variant="secondary" onClick={() => router.push("/report/sample")}>
                        View sample report
                      </Button>
                    )}
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
          </div>
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
