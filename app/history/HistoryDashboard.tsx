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

function toDayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function normExam(v: any) {
  return String(v || "").trim().toUpperCase();
}

function riskBadge(risk: any) {
  const r = String(risk || "").toLowerCase();
  if (!r || r === "none") return null;
  if (r.includes("high") || r.includes("danger") || r.includes("red"))
    return { variant: "destructive" as const, label: risk };
  if (r.includes("medium") || r.includes("warn") || r.includes("amber"))
    return { variant: "secondary" as const, label: risk };
  return { variant: "outline" as const, label: risk };
}

function personaPill(p: any) {
  const label = String(p?.label || p || "").trim();
  const k = label.toLowerCase();

  if (k.includes("safe") || k.includes("caut") || k.includes("conservative")) {
    return {
      label,
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    };
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

export default function HistoryDashboard() {
  const router = useRouter();

  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState<UserDoc | null>(null);

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ insights state
  const [insights, setInsights] = useState<any>(null);

  // profile modal fields
  const [name, setName] = useState("");
  const [coachName, setCoachName] = useState("Prof. Astra");
  const [saving, setSaving] = useState(false);

  // UI controls
  const [examFilter, setExamFilter] = useState<"ALL" | "CAT" | "NEET" | "JEE">(
    "ALL"
  );

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

  async function loadAll() {
    setLoading(true);
    setInsights(null);
    try {
      const [histRes, userRes] = await Promise.all([
        fetch(`/api/history`),
        fetch(`/api/user`),
      ]);

      const histData = await histRes.json();
      const userData = await userRes.json();

      if (!histRes.ok)
        throw new Error(histData?.error || "Failed to load history");
      if (!userRes.ok) throw new Error(userData?.error || "Failed to load user");

      setItems(histData.items || []);
      setUser(userData.user || null);

      const u = userData.user as UserDoc | null;
      setName(u?.displayName || "");
      setCoachName(u?.coach?.coach_name || "Prof. Astra");

      const ex = examFilter === "ALL" ? "" : examFilter;
      const insRes = await fetch(
        `/api/insights?exam=${encodeURIComponent(ex)}&lastN=10`
      );
      const ins = await insRes.json();
      if (insRes.ok) setInsights(ins);
      else setInsights(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load dashboard");
      setItems([]);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examFilter, sessionReady]);

  const filtered = useMemo(() => {
    if (examFilter === "ALL") return items;
    return items.filter((x) => normExam(x.exam) === examFilter);
  }, [items, examFilter]);

  const activeList = filtered;
  const latest = activeList[0];
  const prev = activeList[1];

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

  const greetingName = user?.displayName || "champ";
  const coach = user?.coach?.coach_name || "Prof. Astra";

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

  // render-friendly picks
  const trend = insights?.trend ? String(insights.trend) : "";
  const dominantError = insights?.dominant_error
    ? String(insights.dominant_error)
    : "";
  const risk = riskBadge(insights?.risk_zone);
  const personas = Array.isArray(insights?.personas) ? insights.personas : [];

  const volatility = Number.isFinite(Number(insights?.volatility))
    ? Number(insights?.volatility)
    : 0;

  const consistency =
    insights?.consistency != null ? String(insights.consistency) : "unknown";

  // ✅ NEW: learning behavior fields (safe)
  const lb = insights?.learning_behavior || null;
  const cadence = lb?.cadence ? String(lb.cadence) : "";
  const execStyle = lb?.execution_style ? String(lb.execution_style) : "";
  const loopActive = !!lb?.stuck_loop?.active;
  const loopTopic = lb?.stuck_loop?.topic ? String(lb.stuck_loop.topic) : "";
  const lbEvidence =
    Array.isArray(lb?.evidence) && lb.evidence.length
      ? String(lb.evidence[0] || "")
      : "";

  return (
    <main className="min-h-screen p-6 flex justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-5xl space-y-4">
        {/* Top bar */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-3xl font-bold">
              Welcome back, {greetingName} 👋
            </div>
            <div className="text-sm text-muted-foreground">
              {coach} is tracking your pattern across mocks. No login needed.
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/")}>
              New analysis
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button type="button">Profile setup</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Make it personal</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      Your name (optional)
                    </div>
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

                  <Button
                    className="w-full"
                    onClick={saveProfile}
                    disabled={saving}
                    type="button"
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Later we’ll add exam date + daily time + persona types.
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
            <div className="text-sm text-muted-foreground">
              Consecutive active days based on uploads
            </div>
          </Card>

          <Card className="p-5 rounded-2xl space-y-3 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">🔥 Avg Focus XP</div>
                <div className="text-sm text-muted-foreground">
                  Across your selected timeline
                </div>
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
              <div className="text-sm text-muted-foreground">Loading pattern…</div>
            ) : !insights ? (
              <div className="text-sm text-muted-foreground">
                Upload a few mocks to unlock stronger pattern signals.
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

                  {/* ✅ NEW: Learning behavior chips */}
                  {cadence ? (
                    <Badge
                      variant="secondary"
                      className="rounded-full max-w-full whitespace-normal break-words text-xs leading-snug"
                    >
                      cadence: {cadence}
                    </Badge>
                  ) : null}

                  {loopActive ? (
                    <Badge
                      variant="destructive"
                      className="rounded-full max-w-full whitespace-normal break-words text-xs leading-snug"
                    >
                      loop: {loopTopic || "repeating weakness"}
                    </Badge>
                  ) : null}

                  {execStyle ? (
                    <Badge
                      variant="outline"
                      className="rounded-full bg-white max-w-full whitespace-normal break-words text-xs leading-snug"
                    >
                      style: {execStyle}
                    </Badge>
                  ) : null}
                </div>

                <div className="text-sm text-muted-foreground">
                  Volatility: {volatility}/100 • Consistency: {consistency}
                </div>

                {lbEvidence ? (
                  <div className="text-xs text-muted-foreground">
                    {lbEvidence}
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <Card className="p-5 rounded-2xl space-y-3">
            <div className="text-lg font-semibold">🎯 Quick Suggestion</div>
            {latest ? (
              <div className="text-sm text-muted-foreground">
                Next best move: open your latest report and complete Day 1 + Day
                2 tasks.
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Upload one mock to unlock your personalized dashboard.
              </div>
            )}
            {latest ? (
              <Button
                onClick={() => router.push(`/report/${latest.id}`)}
                className="w-full"
                type="button"
              >
                Open latest report
              </Button>
            ) : (
              <Button
                onClick={() => router.push("/")}
                className="w-full"
                type="button"
              >
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
            <div className="text-sm text-muted-foreground">Loading dashboard…</div>
          ) : activeList.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No attempts yet for this filter.
            </div>
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
                      <Badge className="rounded-full">
                        #{activeList.length - idx}
                      </Badge>
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
          Sticky loop: upload → dashboard remembers → insights improve → upload again.
        </div>
      </div>
    </main>
  );
}
