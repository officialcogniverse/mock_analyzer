"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { NextBestActionRail } from "@/components/next-best-action-rail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeExam } from "@/lib/exams";
import { ensureSession } from "@/lib/userClient";

type HistoryItem = {
  id: string;
  exam: string;
  createdAt: string | Date;
  summary: string;
  focusXP: number;
  estimatedScore?: number | null;
  errorTypes?: Record<string, number>;
};

type UserDoc = {
  _id: string;
  displayName: string | null;
  examDefault: string | null;
  coach?: { coach_name: string; tone: string; style: string };
};

type ProgressDoc = {
  userId?: string;
  exam: string;
  nextMockInDays?: number;
  minutesPerDay?: number;
  confidence?: number; // 0..100
  probes?: Array<{ id: string; title: string; done?: boolean; doneAt?: string }>;
  reminder?: { time?: string | null; channel?: "whatsapp" | "email" | "sms" | "push" | "none" };
  planAdherence?: Array<{ date: string; done: boolean }>;
};

type ProgressApiResponse = {
  progress: ProgressDoc;
};

type NextAction = {
  id: string;
  title: string;
  steps: string[];
  metric?: string;
  expectedImpact: "High" | "Medium" | "Low";
  effort: string;
  evidence: string[];
};

type CohortInsights = {
  cohortSize: number;
  attemptsCount: number;
  scoreBenchmarks: { p50: number | null; p75: number | null; p90: number | null };
  commonMistakes: Record<string, number>;
  progressVelocity: { averageDelta: number | null; positiveShare: number | null };
};

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function normExam(v: any) {
  return normalizeExam(String(v || "")) || "GENERIC";
}

function titleCase(x: string) {
  const s = String(x || "").trim();
  if (!s) return "";
  return s
    .split("_")
    .join(" ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function riskBadge(risk: any) {
  const r = String(risk || "").toLowerCase();
  if (!r || r === "none") return null;
  if (r.includes("high") || r.includes("danger") || r.includes("red"))
    return { variant: "destructive" as const, label: String(risk) };
  if (r.includes("medium") || r.includes("warn") || r.includes("amber"))
    return { variant: "secondary" as const, label: String(risk) };
  return { variant: "outline" as const, label: String(risk) };
}

function personaPill(p: any) {
  const label = String(p?.label || p || "").trim();
  const k = label.toLowerCase();

  if (k.includes("safe") || k.includes("caut") || k.includes("conservative")) {
    return { label, className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
  }
  if (k.includes("risk") || k.includes("aggressive") || k.includes("gambler")) {
    return { label, className: "bg-rose-50 text-rose-800 border-rose-200" };
  }
  if (k.includes("panic") || k.includes("anx") || k.includes("impulsive")) {
    return { label, className: "bg-amber-50 text-amber-900 border-amber-200" };
  }
  if (k.includes("precision") || k.includes("accur") || k.includes("careful")) {
    return { label, className: "bg-sky-50 text-sky-900 border-sky-200" };
  }
  if (k.includes("speed") || k.includes("fast")) {
    return { label, className: "bg-violet-50 text-violet-900 border-violet-200" };
  }
  return { label, className: "bg-slate-50 text-slate-900 border-slate-200" };
}

function confLabel(v: number) {
  if (v >= 80) return "High";
  if (v >= 60) return "Medium";
  if (v >= 40) return "Building";
  return "Low";
}

export default function HistoryDashboard() {
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);

  const [user, setUser] = useState<UserDoc | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // insights state (pattern summary)
  const [insights, setInsights] = useState<any>(null);

  // per-exam progress state (planner + probes + confidence)
  const [progressDoc, setProgressDoc] = useState<ProgressDoc | null>(null);

  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [nextActionsLoading, setNextActionsLoading] = useState(false);

  const [cohortInsights, setCohortInsights] = useState<CohortInsights | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);

  const [reminderTime, setReminderTime] = useState("");
  const [reminderChannel, setReminderChannel] = useState<
    "whatsapp" | "email" | "sms" | "push" | "none"
  >("push");
  const [planAdherence, setPlanAdherence] = useState<Array<{ date: string; done: boolean }>>(
    []
  );

  // profile modal fields
  const [name, setName] = useState("");
  const [coachName, setCoachName] = useState("Prof. Astra");
  const [saving, setSaving] = useState(false);

  // UI controls (exam metadata is informational only)
  // Journey pointer (optional)
  const [lastReportId, setLastReportId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const x = localStorage.getItem("cogniverse_last_report_id");
      if (x) setLastReportId(x);
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    ensureSession()
      .then(() => {
        if (isMounted) setSessionReady(true);
      })
      .catch(() => {
        toast.error("Could not start session. Try another browser.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeList = useMemo(() => items, [items]);
  const latest = activeList[0];
  const prev = activeList[1];

  const greetingName = user?.displayName || "champ";
  const coach = user?.coach?.coach_name || "Prof. Astra";

  const avgXP = useMemo(() => {
    if (!activeList.length) return 0;
    const sum = activeList.reduce((a, x) => a + (x.focusXP || 0), 0);
    return Math.round(sum / activeList.length);
  }, [activeList]);

  const deltaXP = useMemo(() => {
    if (!latest || !prev) return 0;
    return (latest.focusXP || 0) - (prev.focusXP || 0);
  }, [latest, prev]);

  const streak = useMemo(() => {
    const arr = activeList.slice().map((x) => new Date(x.createdAt));
    if (!arr.length) return 0;

    arr.sort((a, b) => b.getTime() - a.getTime());
    const uniqueDays = Array.from(new Set(arr.map(toDayKey)));

    let s = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const prevDay = new Date(uniqueDays[i - 1]);
      const currDay = new Date(uniqueDays[i]);
      const diff =
        (prevDay.getTime() - currDay.getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= 1 && diff < 2) s += 1;
      else break;
    }
    return s;
  }, [activeList]);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          coach: { coach_name: coachName },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setUser(data.user);
      toast.success("Profile saved ✅");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function downloadExport(format: "csv" | "json") {
    try {
      const res = await fetch(`/api/export?format=${format}`);
      if (!res.ok) {
        toast.error("Export failed");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cogniverse_export.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  function resolveProgressExam(list: HistoryItem[]) {
    if (!list.length) return null;
    return normExam(list?.[0]?.exam) || "GENERIC";
  }

  async function loadAll() {
    setLoading(true);
    setInsights(null);
    setProgressDoc(null);
    setCohortInsights(null);

    try {
      const [histRes, userRes] = await Promise.all([
        fetch("/api/history"),
        fetch("/api/user"),
      ]);

      const histData = await histRes.json();
      const userData = await userRes.json();

      if (!histRes.ok) throw new Error(histData?.error || "Failed to load history");
      if (!userRes.ok) throw new Error(userData?.error || "Failed to load user");

      const list: HistoryItem[] = histData.items || [];
      setItems(list);
      setUser(userData.user || null);

      const u = userData.user as UserDoc | null;
      setName(u?.displayName || "");
      setCoachName(u?.coach?.coach_name || "Prof. Astra");

      // insights: allow ALL (empty exam)
      const insRes = await fetch(`/api/insights?lastN=10`);
      const insJson = await insRes.json();
      setInsights(insRes.ok ? insJson : null);

      // progress: per exam only (resolve from filter or latest attempt)
      const exForProgress = resolveProgressExam(list);
      if (exForProgress) {
        const prRes = await fetch(`/api/progress?exam=${exForProgress}`);
        const prJson = (await prRes.json()) as ProgressApiResponse;
        if (prRes.ok) setProgressDoc(prJson.progress);
      }

      setCohortLoading(true);
      const cohortRes = await fetch(`/api/cohort-insights?limit=250`);
      const cohortJson = await cohortRes.json();
      if (cohortRes.ok) setCohortInsights(cohortJson as CohortInsights);
      setCohortLoading(false);

      // last report id fallback
      if (typeof window !== "undefined") {
        const latestId = String(list?.[0]?.id || "");
        if (!lastReportId && latestId) {
          localStorage.setItem("cogniverse_last_report_id", latestId);
          setLastReportId(latestId);
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load dashboard");
      setItems([]);
      setInsights(null);
      setProgressDoc(null);
      setCohortInsights(null);
    } finally {
      setLoading(false);
      setCohortLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady]);

  useEffect(() => {
    if (!progressDoc) return;
    setReminderTime(progressDoc.reminder?.time || "");
    setReminderChannel(progressDoc.reminder?.channel || "push");
    setPlanAdherence(progressDoc.planAdherence || []);
  }, [progressDoc]);

  async function saveReminder() {
    if (!progressDoc?.exam) return;
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: progressDoc.exam,
          reminder: { time: reminderTime || null, channel: reminderChannel },
        }),
      });
      const json = await res.json();
      if (res.ok) setProgressDoc(json.progress);
      else toast.error(json?.error || "Reminder save failed");
    } catch {
      toast.error("Reminder save failed");
    }
  }

  async function togglePlanDay(date: string, done: boolean) {
    if (!progressDoc?.exam) return;
    const next = planAdherence.filter((d) => d.date !== date);
    next.push({ date, done });
    setPlanAdherence(next);

    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: progressDoc.exam,
          planAdherence: next,
        }),
      });
      const json = await res.json();
      if (res.ok) setProgressDoc(json.progress);
    } catch {
      // ignore for now
    }
  }

  // render-friendly picks (pattern)
  const trend = insights?.trend ? String(insights.trend) : "";
  const dominantError = insights?.dominant_error ? String(insights.dominant_error) : "";
  const risk = riskBadge(insights?.risk_zone);
  const personas = Array.isArray(insights?.personas) ? insights.personas : [];

  const volatility = Number.isFinite(Number(insights?.volatility))
    ? Number(insights?.volatility)
    : 0;

  const consistency = insights?.consistency != null ? String(insights.consistency) : "unknown";

  const lb = insights?.learning_behavior || null;
  const cadence = lb?.cadence ? String(lb.cadence) : "";
  const execStyle = lb?.execution_style ? String(lb.execution_style) : "";
  const loopActive = !!lb?.stuck_loop?.active;
  const loopTopic = lb?.stuck_loop?.topic ? String(lb.stuck_loop.topic) : "";

  const continueId = lastReportId || latest?.id || null;

  // progress mini-metrics
  const probeDoneCount = useMemo(() => {
    const list = progressDoc?.probes || [];
    return list.filter((p) => !!p.done).length;
  }, [progressDoc]);

  const probeTotal = useMemo(() => {
    const list = progressDoc?.probes || [];
    return list.length;
  }, [progressDoc]);

  const plannerDays = progressDoc?.nextMockInDays ?? null;
  const minutesPerDay = progressDoc?.minutesPerDay ?? null;

  // if backend provides confidence, use it; else a conservative fallback
  const backendConfidence = Number.isFinite(Number(progressDoc?.confidence))
    ? Number(progressDoc?.confidence)
    : null;

  const conf =
    backendConfidence ??
    (probeTotal ? Math.round((probeDoneCount / probeTotal) * 70) + 10 : 10);

  const confText = confLabel(conf);

  const progressExam = progressDoc?.exam || null;
  const examBadge = activeList[0]?.exam ? normExam(activeList[0].exam) : "All attempts";

  const nextActionExam = useMemo(
    () => resolveProgressExam(activeList) || progressExam || null,
    [activeList, progressExam]
  );

  const adherenceMap = useMemo(() => {
    return (planAdherence || []).reduce<Record<string, boolean>>((acc, item) => {
      acc[item.date] = item.done;
      return acc;
    }, {});
  }, [planAdherence]);

  const upcomingDays = useMemo(() => {
    const days: Array<{ key: string; label: string }> = [];
    const today = new Date();
    for (let i = 0; i < 3; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      days.push({ key, label });
    }
    return days;
  }, []);

  useEffect(() => {
    if (!nextActionExam) {
      setNextActions([]);
      setNextActionsLoading(false);
      return;
    }

    let active = true;
    setNextActionsLoading(true);

    fetch(`/api/next-actions?exam=${encodeURIComponent(nextActionExam)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!active) return;
        setNextActions(Array.isArray(json?.actions) ? json.actions : []);
      })
      .catch(() => {
        if (active) setNextActions([]);
      })
      .finally(() => {
        if (active) setNextActionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [nextActionExam]);

  return (
    <main className="min-h-screen p-6 flex justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-3xl font-bold">Welcome back, {greetingName} 👋</div>
            <div className="text-sm text-muted-foreground">
              {coach} is tracking your pattern across mocks. Focus = score uplift.
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/")}>
              New analysis
            </Button>
            <Button variant="outline" onClick={() => downloadExport("csv")}>
              Export CSV
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button">Profile</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Make it personal</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Your name (optional)</div>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Srijan"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-medium">Coach name</div>
                    <Input
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      placeholder="e.g., Prof. Astra"
                    />
                  </div>

                  <Button className="w-full" onClick={saveProfile} disabled={saving} type="button">
                    {saving ? "Saving..." : "Save"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Keep it minimal. No account needed.
                  </div>

                  <div className="pt-2 space-y-2">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">
                      Data portability
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadExport("json")}
                      >
                        Export JSON
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadExport("csv")}
                      >
                        Export CSV
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Journey CTA */}
        <Card className="p-5 rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">🧩 Your journey (uplift loop)</div>
              <div className="text-sm text-muted-foreground">
                Open report → complete probes → confidence rises → next mock.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {continueId ? (
                <Button type="button" onClick={() => router.push(`/report/${continueId}`)}>
                  Continue →
                </Button>
              ) : (
                <Button type="button" onClick={() => router.push("/")}>
                  Upload first mock →
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => router.push("/report/sample")}>
                View sample report
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="flex items-end justify-between">
                <div className="text-2xl font-bold">{conf}</div>
                <Badge variant="secondary" className="rounded-full">
                  {confText}
                </Badge>
              </div>
              <Progress value={conf} />
              <div className="text-[11px] text-muted-foreground mt-1">
                {backendConfidence != null
                  ? "From progress engine"
                  : "Fallback until backend computes confidence"}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-muted-foreground">Probes done</div>
              <div className="text-2xl font-bold">
                {probeDoneCount}/{probeTotal || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {probeTotal ? "Logged inside report" : "Start quest in report"}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-3">
              <div className="text-xs text-muted-foreground">Planner</div>
              <div className="text-sm">
                {plannerDays ? (
                  <>
                    <span className="font-semibold">{plannerDays} days</span>{" "}
                    <span className="text-muted-foreground">•</span>{" "}
                    <span className="font-semibold">{minutesPerDay ?? 40} min/day</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Set in report</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {progressExam ? `Attempt group: ${progressExam}` : "All attempts"}
              </div>
            </div>
          </div>
        </Card>

        {/* Dashboard cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl space-y-2">
            <div className="text-lg font-semibold">⚡ Streak</div>
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-sm text-muted-foreground">
              Counts only full mocks or completed probes.
            </div>
          </Card>

          <Card className="p-5 rounded-2xl space-y-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">🔥 Avg Focus XP</div>
                <div className="text-sm text-muted-foreground">For this timeline</div>
              </div>
              <div className="text-2xl font-bold">{avgXP}</div>
            </div>
            <Progress value={avgXP} />
            <div className="text-xs text-muted-foreground">
              Latest delta:{" "}
              <span className="font-medium">
                {deltaXP === 0 ? "±0" : deltaXP > 0 ? `+${deltaXP}` : `${deltaXP}`}
              </span>{" "}
              vs previous mock
            </div>
          </Card>

          {/* Pattern card */}
          <Card className="p-5 rounded-2xl space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="text-lg font-semibold">🧠 Pattern</div>
              <Badge
                variant="secondary"
                className="rounded-full shrink-0 max-w-full whitespace-normal break-words"
              >
                {examBadge}
              </Badge>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : !insights ? (
              <div className="text-sm text-muted-foreground">
                Upload a few mocks to unlock stronger signals.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 max-w-full min-w-0">
                  {trend ? (
                    <Badge className="rounded-full bg-indigo-50 text-indigo-900 border-indigo-200 max-w-full whitespace-normal break-words text-xs leading-snug">
                      {trend}
                    </Badge>
                  ) : null}

                  {dominantError ? (
                    <Badge
                      variant="secondary"
                      className="rounded-full bg-slate-50 text-slate-900 border-slate-200 max-w-full whitespace-normal break-words text-xs leading-snug"
                    >
                      {dominantError}
                    </Badge>
                  ) : null}

                  {risk ? (
                    <Badge
                      variant={risk.variant}
                      className="rounded-full max-w-full whitespace-normal break-words text-xs leading-snug"
                    >
                      {risk.label}
                    </Badge>
                  ) : null}

                  {personas.map((p: any, i: number) => {
                    const pill = personaPill(p);
                    if (!pill.label) return null;
                    return (
                      <Badge
                        key={i}
                        variant="outline"
                        className={`rounded-full ${pill.className} max-w-full whitespace-normal break-words text-xs leading-snug`}
                      >
                        {pill.label}
                      </Badge>
                    );
                  })}

                  {cadence ? (
                    <Badge variant="secondary" className="rounded-full text-xs leading-snug">
                      cadence: {titleCase(cadence)}
                    </Badge>
                  ) : null}

                  {loopActive ? (
                    <Badge variant="destructive" className="rounded-full text-xs leading-snug">
                      loop: {loopTopic || "repeating weakness"}
                    </Badge>
                  ) : null}

                  {execStyle ? (
                    <Badge variant="outline" className="rounded-full bg-white text-xs leading-snug">
                      style: {titleCase(execStyle)}
                    </Badge>
                  ) : null}
                </div>

                <div className="text-sm text-muted-foreground">
                  Volatility: {volatility}/100 • Consistency: {consistency}
                </div>
              </>
            )}
          </Card>

          <Card className="p-5 rounded-2xl space-y-3">
            <div className="text-lg font-semibold">🎯 Next move</div>
            {latest ? (
              <div className="text-sm text-muted-foreground">
                Open latest report → complete 2 probes → log accuracy/time.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Upload one mock to unlock your uplift loop.
              </div>
            )}

            {latest ? (
              <Button onClick={() => router.push(`/report/${latest.id}`)} className="w-full" type="button">
                Open latest report
              </Button>
            ) : (
              <Button onClick={() => router.push("/")} className="w-full" type="button">
                Upload first mock
              </Button>
            )}
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">🌍 Cohort insights</div>
              <Badge variant="secondary" className="rounded-full">
                {examBadge}
              </Badge>
            </div>

            {cohortLoading ? (
              <div className="text-sm text-muted-foreground">Loading cohort trends…</div>
            ) : !cohortInsights ? (
              <div className="text-sm text-muted-foreground">
                Not enough cohort data yet. Analyze more mocks to build benchmarks.
              </div>
            ) : (
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs uppercase text-muted-foreground">P50</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {cohortInsights.scoreBenchmarks.p50 ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs uppercase text-muted-foreground">P75</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {cohortInsights.scoreBenchmarks.p75 ?? "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-white p-3">
                    <div className="text-xs uppercase text-muted-foreground">P90</div>
                    <div className="text-lg font-semibold text-slate-900">
                      {cohortInsights.scoreBenchmarks.p90 ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(cohortInsights.commonMistakes || {}).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="rounded-full">
                      {titleCase(key)} {value}%
                    </Badge>
                  ))}
                </div>
                <div>
                  Velocity:{" "}
                  <span className="font-medium text-slate-900">
                    {cohortInsights.progressVelocity.averageDelta != null
                      ? `${cohortInsights.progressVelocity.averageDelta > 0 ? "+" : ""}${
                          cohortInsights.progressVelocity.averageDelta
                        } pts`
                      : "—"}
                  </span>{" "}
                  • Positive share:{" "}
                  <span className="font-medium text-slate-900">
                    {cohortInsights.progressVelocity.positiveShare != null
                      ? `${cohortInsights.progressVelocity.positiveShare}%`
                      : "—"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Aggregated across {cohortInsights.cohortSize} learners.
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 rounded-2xl space-y-3">
            <div className="text-lg font-semibold">🔔 Nudge + plan adherence</div>
            <div className="text-sm text-muted-foreground">
              Schedule daily reminders and track plan completion to reduce drop-off.
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Reminder time</div>
                <Input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Channel</div>
                <Input
                  value={reminderChannel}
                  onChange={(e) =>
                    setReminderChannel(
                      (e.target.value as "whatsapp" | "email" | "sms" | "push" | "none") || "push"
                    )
                  }
                  placeholder="push"
                />
              </div>
            </div>
            <Button type="button" variant="outline" onClick={saveReminder}>
              Save reminder
            </Button>
            <div className="space-y-2">
              {upcomingDays.map((day) => (
                <div key={day.key} className="flex items-center justify-between rounded-xl border bg-white p-3">
                  <div className="text-sm">{day.label}</div>
                  <Button
                    type="button"
                    size="sm"
                    variant={adherenceMap[day.key] ? "secondary" : "outline"}
                    onClick={() => togglePlanDay(day.key, !adherenceMap[day.key])}
                  >
                    {adherenceMap[day.key] ? "Done" : "Mark done"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              Countdown: {plannerDays ? `${plannerDays} days to next mock` : "Set next mock date in report."}
            </div>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">📜 Timeline</div>
            <Badge variant="secondary" className="rounded-full">
              {activeList.length} attempts
            </Badge>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : activeList.length === 0 ? (
            <div className="text-sm text-muted-foreground">No attempts yet for this filter.</div>
          ) : (
            <div className="space-y-3">
              {activeList.map((x, idx) => (
                <button
                  key={x.id}
                  onClick={() => router.push(`/report/${x.id}`)}
                  className="w-full text-left rounded-xl border bg-white p-4 hover:shadow-sm transition"
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className="rounded-full">#{activeList.length - idx}</Badge>
                      <span className="font-medium">{normExam(x.exam)}</span>
                      <span className="text-xs text-muted-foreground">
                        • {new Date(x.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      XP {x.focusXP ?? 0}
                    </Badge>
                  </div>

                  <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {x.summary || "Summary not available."}
                  </div>

                  <div className="mt-3">
                    <Progress value={x.focusXP ?? 0} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="text-xs text-muted-foreground">
          Loop: Upload → Plan → Probes → Confidence → Next mock → Upload again.
        </div>
      </div>

      <NextBestActionRail
        actions={nextActions}
        loading={nextActionsLoading}
        title="Next best action"
        emptyMessage="Analyze a mock to unlock the next best action."
        ctaLabel={latest ? "Open latest report" : "Upload first mock"}
        onCtaClick={() => (latest ? router.push(`/report/${latest.id}`) : router.push("/"))}
      />
      </div>
    </main>
  );
}
