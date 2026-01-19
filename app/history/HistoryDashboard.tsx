"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ensureSession } from "@/lib/userClient";

type Exam = "CAT" | "NEET" | "JEE";
type ExamFilter = "ALL" | Exam;

type HistoryItem = {
  id: string;
  exam: string;
  createdAt: string | Date;
  summary: string;
  focusXP: number;
};

type UserDoc = {
  _id: string;
  displayName: string | null;
  examDefault: string | null;
  coach?: { coach_name: string; tone: string; style: string };
};

type ProgressDoc = {
  userId?: string;
  exam: Exam;
  nextMockInDays?: number;
  minutesPerDay?: number;
  confidence?: number; // 0..100
  probes?: Array<{ id: string; title: string; done?: boolean; doneAt?: string }>;
};

type ProgressApiResponse = {
  progress: ProgressDoc;
};

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function normExam(v: any) {
  return String(v || "").trim().toUpperCase();
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

function isExam(x: any): x is Exam {
  return x === "CAT" || x === "NEET" || x === "JEE";
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

  // profile modal fields
  const [name, setName] = useState("");
  const [coachName, setCoachName] = useState("Prof. Astra");
  const [saving, setSaving] = useState(false);

  // UI controls
  const [examFilter, setExamFilter] = useState<ExamFilter>("ALL");

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

  const filtered = useMemo(() => {
    if (examFilter === "ALL") return items;
    return items.filter((x) => normExam(x.exam) === examFilter);
  }, [items, examFilter]);

  const activeList = filtered;
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

  function resolveProgressExam(list: HistoryItem[], filter: ExamFilter): Exam | null {
    if (filter !== "ALL") return filter;
    const latestExam = normExam(list?.[0]?.exam);
    return isExam(latestExam) ? (latestExam as Exam) : null;
  }

  async function loadAll() {
    setLoading(true);
    setInsights(null);
    setProgressDoc(null);

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
      const exForInsights = examFilter === "ALL" ? "" : examFilter;
      const insRes = await fetch(`/api/insights?exam=${encodeURIComponent(exForInsights)}&lastN=10`);
      const insJson = await insRes.json();
      setInsights(insRes.ok ? insJson : null);

      // progress: per exam only (resolve from filter or latest attempt)
      const exForProgress = resolveProgressExam(list, examFilter);
      if (exForProgress) {
        const prRes = await fetch(`/api/progress?exam=${exForProgress}`);
        const prJson = (await prRes.json()) as ProgressApiResponse;
        if (prRes.ok) setProgressDoc(prJson.progress);
      }

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
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, examFilter]);

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

  return (
    <main className="min-h-screen p-6 flex justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-5xl space-y-4">
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
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Journey CTA */}
        <Card className="p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">🧩 Your journey (uplift loop)</div>
              <div className="text-sm text-muted-foreground">
                Open report → complete probes → confidence rises → next mock.
              </div>
            </div>

            {continueId ? (
              <Button type="button" onClick={() => router.push(`/report/${continueId}`)}>
                Continue →
              </Button>
            ) : (
              <Button type="button" onClick={() => router.push("/")}>
                Upload first mock →
              </Button>
            )}
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
                {progressExam ? `Exam: ${progressExam}` : "Per-exam progress"}
              </div>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["ALL", "CAT", "NEET", "JEE"] as const).map((x) => (
            <Button
              key={x}
              type="button"
              variant={examFilter === x ? "default" : "outline"}
              onClick={() => setExamFilter(x)}
            >
              {x === "ALL" ? "All exams" : x}
            </Button>
          ))}
        </div>

        {/* Dashboard cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="p-5 rounded-2xl space-y-2">
            <div className="text-lg font-semibold">⚡ Streak</div>
            <div className="text-3xl font-bold">{streak}</div>
            <div className="text-sm text-muted-foreground">Based on uploads</div>
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
                {examFilter === "ALL" ? "All exams" : examFilter}
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
    </main>
  );
}
