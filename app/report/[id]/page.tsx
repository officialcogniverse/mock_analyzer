"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExamPatternChecklist } from "@/components/ExamPatternChecklist";
import { NextBestActionRail } from "@/components/next-best-action-rail";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  sampleHistoryItems,
  sampleInsights,
  sampleLearningState,
  sampleNextActions,
  sampleProgressDoc,
  sampleReportPayload,
} from "@/lib/sampleData";

type ApiOk = {
  id: string;
  createdAt: string;
  exam: string;
  report: any;
};

type ApiErr = { error: string };
type LearningCurvePoint = { index?: number; xp?: number; date?: string | null };
type LearningState = {
  attemptCount?: number;
  lastScorePct?: number | null;
  rollingScorePct?: number | null;
  lastDeltaScorePct?: number | null;
  rollingDeltaScorePct?: number | null;
};
type HistoryItem = {
  id: string;
  exam: string;
  createdAt: string | Date;
  summary?: string;
  focusXP?: number;
  estimatedScore?: number | null;
  errorTypes?: Record<string, number>;
};

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
function detectedFromText(plan: any) {
  const assumptions = Array.isArray(plan?.confidence?.assumptions)
    ? plan.confidence.assumptions
    : [];
  const missing = Array.isArray(plan?.confidence?.missing_signals)
    ? plan.confidence.missing_signals
    : [];

  const parts = assumptions.filter(Boolean).slice(0, 2);
  if (parts.length) return parts.join(" + ");

  if (missing.length) return `Limited signals: ${missing.slice(0, 2).join(" + ")}`;

  return null;
}

function curvePath(values: number[], width: number, height: number, padding = 16) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  return values
    .map((v, i) => {
      const x =
        padding +
        (values.length === 1 ? 0 : (usableWidth * i) / (values.length - 1));
      const y = padding + usableHeight - ((v - min) / span) * usableHeight;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}


type ProbeType = "topic_drill" | "execution_drill" | "review_drill";

type Probe = {
  id: string;
  type: ProbeType;
  title: string;
  minutes: number;
  instructions: string[];
  targetAccuracy: number;
  why: string;
};

type ProbeResultLocal = {
  accuracy?: number; // 0-100
  time_min?: number;
  self_confidence?: number; // 1-5
  notes?: string;
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

type ProgressDoc = {
  userId?: string;
  exam: string;
  nextMockInDays: number;
  minutesPerDay: number;
  probes: Array<{
    id: string;
    title: string;
    done: boolean;
    doneAt?: string | null;
    tags?: string[];
  }>;
  probeMetrics?: Record<string, ProbeResultLocal>;
  confidence: number; // 0..100 (we will write computed value here)
  updatedAt?: string;
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isSample = id === "sample";

  const [data, setData] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string>("");
  const [tabValue, setTabValue] = useState("summary");

  const [insights, setInsights] = useState<any | null>(null);
  const [learningState, setLearningState] = useState<LearningState | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<HistoryItem[]>([]);

  // DB-backed progress per exam
  const [progressDoc, setProgressDoc] = useState<ProgressDoc | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // local-only probe metrics per attempt
  const localProbeKey = useMemo(() => `cogniverse_probe_metrics_${id}`, [id]);
  const [probeMetrics, setProbeMetrics] = useState<
    Record<string, ProbeResultLocal>
  >({});

  // local booster answers (UI only for now)
  const [boostAnswers, setBoostAnswers] = useState<Record<string, string>>({});

  const [nextActions, setNextActions] = useState<NextAction[]>([]);
  const [nextActionsLoading, setNextActionsLoading] = useState(false);

  // store last report id so History can “Continue journey”
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSample) return;
    try {
      localStorage.setItem("cogniverse_last_report_id", String(id));
    } catch {}
  }, [id, isSample]);

  // load local probe metrics
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(localProbeKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setProbeMetrics(parsed);
    } catch {}
  }, [localProbeKey]);

  // persist local probe metrics
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(localProbeKey, JSON.stringify(probeMetrics));
    } catch {}
  }, [localProbeKey, probeMetrics]);

  // hydrate probe metrics from DB (merge to preserve local edits)
  useEffect(() => {
    if (!progressDoc?.probeMetrics) return;
    setProbeMetrics((prev) => ({
      ...progressDoc.probeMetrics,
      ...prev,
    }));
  }, [progressDoc?.probeMetrics]);

  function setProbeMetric(probeId: string, patch: Partial<ProbeResultLocal>) {
    setProbeMetrics((prev) => ({
      ...prev,
      [probeId]: { ...(prev[probeId] || {}), ...patch },
    }));
  }

  // ------------------------
  // Load report
  // ------------------------
  useEffect(() => {
    (async () => {
      try {
        if (isSample) {
          setData(sampleReportPayload as ApiOk);
          setError("");
          return;
        }

        const res = await fetch(`/api/report/${id}`);
        const json = (await res.json()) as ApiOk | ApiErr;

        if (!res.ok) {
          setError((json as ApiErr).error || "Failed to load report");
          setData(null);
          return;
        }

        if (!(json as ApiOk).report) {
          setError("Report missing (try analyzing again).");
          setData(null);
          return;
        }

        setData(json as ApiOk);
        setError("");
      } catch {
        setError("Network error while loading report");
        setData(null);
      }
    })();
  }, [id, isSample]);

  const r = data?.report;

  // ------------------------
  // Load insights + progress once exam is known
  // ------------------------
  useEffect(() => {
    if (!data?.exam) return;
    let active = true;

    (async () => {
      try {
        if (isSample) {
          if (active) {
            setInsights(sampleInsights);
            setLearningState(sampleLearningState as LearningState);
            setProgressDoc(sampleProgressDoc as ProgressDoc);
            setRecentAttempts(sampleHistoryItems as HistoryItem[]);
          }
          return;
        }

        // insights
        const insRes = await fetch(
          `/api/insights?exam=${encodeURIComponent(data.exam)}&lastN=10`
        );
        if (insRes.ok) {
          const ins = await insRes.json();
          if (active) setInsights(ins);
        }

        const lsRes = await fetch(
          `/api/learning-state?exam=${encodeURIComponent(data.exam)}`
        );
        if (lsRes.ok) {
          const ls = await lsRes.json();
          if (active) setLearningState(ls?.learningState || null);
        }

        // progress
        setProgressLoading(true);
        const prRes = await fetch(
          `/api/progress?exam=${encodeURIComponent(data.exam)}`
        );
        const pr = await prRes.json();
        if (prRes.ok && active) {
          setProgressDoc(pr?.progress || pr || null);
        }

        const histRes = await fetch(
          `/api/history?exam=${encodeURIComponent(data.exam)}&limit=6`
        );
        const hist = await histRes.json();
        if (histRes.ok && active) {
          setRecentAttempts(Array.isArray(hist?.items) ? hist.items : []);
        }
      } catch {
        // ignore
      } finally {
        if (active) setProgressLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [data?.exam, isSample]);

  // load next-best actions
  useEffect(() => {
    if (!data?.exam) return;
    let active = true;
    setNextActionsLoading(true);

    (async () => {
      try {
        if (isSample) {
          if (active) setNextActions(sampleNextActions);
          return;
        }

        const res = await fetch(
          `/api/next-actions?exam=${encodeURIComponent(data.exam)}`
        );
        const json = await res.json();
        if (res.ok && active) {
          setNextActions(Array.isArray(json?.actions) ? json.actions : []);
        }
      } catch {
        // ignore
      } finally {
        if (active) setNextActionsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [data?.exam, isSample]);

  // Planner values from DB (fallback defaults)
  const nextMockInDays = useMemo(() => {
    const v = Number(progressDoc?.nextMockInDays);
    return [2, 4, 7, 14].includes(v) ? (v as 2 | 4 | 7 | 14) : 7;
  }, [progressDoc]);

  const minutesPerDay = useMemo(() => {
    const v = Number(progressDoc?.minutesPerDay);
    return [20, 40, 60, 90].includes(v) ? (v as 20 | 40 | 60 | 90) : 40;
  }, [progressDoc]);

  async function savePlanner(patch: {
    nextMockInDays?: number;
    minutesPerDay?: number;
  }) {
    if (!data?.exam || isSample) return;
    try {
      // optimistic UI
      setProgressDoc((prev) =>
        prev
          ? ({ ...prev, ...patch } as ProgressDoc)
          : ({
              exam: data.exam,
              nextMockInDays: patch.nextMockInDays ?? 7,
              minutesPerDay: patch.minutesPerDay ?? 40,
              probes: [],
              confidence: 0,
            } as ProgressDoc)
      );

      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exam: data.exam, ...patch }),
      });
      const json = await res.json();
      if (res.ok) setProgressDoc(json?.progress || json || null);
    } catch {
      // ignore
    }
  }

  function scaleTasks(tasks: string[], factor: number) {
    const safe = Array.isArray(tasks) ? tasks : [];
    if (!safe.length) return safe;

    if (factor <= 0.75)
      return safe.slice(0, Math.max(2, Math.ceil(safe.length * 0.6)));
    if (factor <= 1.0)
      return safe.slice(0, Math.max(3, Math.ceil(safe.length * 0.8)));
    if (factor >= 1.5) return safe;
    return safe;
  }

  const plannedDays = useMemo(
    () => Math.max(2, Math.min(14, Number(nextMockInDays || 7))),
    [nextMockInDays]
  );

  // ✅ Adaptive plan source: study_plan preferred; fallback to old fourteen_day_plan
  const adjustedPlan = useMemo(() => {
    const basePlan = Array.isArray(r?.study_plan)
      ? r.study_plan
      : Array.isArray(r?.fourteen_day_plan)
      ? r.fourteen_day_plan
      : [];

    if (!basePlan.length) return [];

    const factor = Number(minutesPerDay) / 40;
    const slice = basePlan.slice(0, plannedDays);

    return slice.map((dayObj: any, idx: number) => {
      const baseMinutes = Number(dayObj?.time_minutes) || 40;
      const newMinutes = Math.max(15, Math.round(baseMinutes * factor));
      const newTasks = scaleTasks(dayObj?.tasks || [], factor);
      const dayNum = Number(dayObj?.day) || idx + 1;
      return { ...dayObj, day: dayNum, time_minutes: newMinutes, tasks: newTasks };
    });
  }, [r, plannedDays, minutesPerDay]);

  const weeklyPlan = useMemo(() => {
    if (!adjustedPlan.length) return [];
    const weeks: Array<{
      week: number;
      days: number[];
      totalMinutes: number;
      taskCount: number;
      focus: string[];
    }> = [];

    for (let i = 0; i < adjustedPlan.length; i += 7) {
      const chunk = adjustedPlan.slice(i, i + 7);
      const weekIndex = Math.floor(i / 7) + 1;
      weeks.push({
        week: weekIndex,
        days: chunk.map((d: any) => Number(d.day)),
        totalMinutes: chunk.reduce(
          (sum: number, d: any) => sum + (Number(d.time_minutes) || 0),
          0
        ),
        taskCount: chunk.reduce(
          (sum: number, d: any) => sum + (Array.isArray(d.tasks) ? d.tasks.length : 0),
          0
        ),
        focus: Array.from(
          new Set(chunk.map((d: any) => String(d.focus || "")).filter(Boolean))
        ),
      });
    }

    return weeks;
  }, [adjustedPlan]);

  const outcomeDeltas = useMemo(() => {
    const sorted = [...recentAttempts].sort((a, b) => {
      const ad = new Date(a.createdAt).getTime();
      const bd = new Date(b.createdAt).getTime();
      return bd - ad;
    });
    const recent = sorted.slice(0, 3);
    const previous = sorted.slice(3, 6);

    const avg = (list: HistoryItem[], pick: (x: HistoryItem) => number | null) => {
      const values = list
        .map((item) => pick(item))
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      if (!values.length) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const toAccuracy = (item: HistoryItem) => {
      const et = item.errorTypes || {};
      const careless = Number(et.careless || 0);
      const comprehension = Number(et.comprehension || 0);
      return Math.max(0, Math.min(100, 100 - careless - comprehension));
    };

    const toSpeed = (item: HistoryItem) => {
      const et = item.errorTypes || {};
      const time = Number(et.time || 0);
      return Math.max(0, Math.min(100, 100 - time));
    };

    const recentScore = avg(recent, (x) =>
      typeof x.estimatedScore === "number" ? x.estimatedScore : null
    );
    const previousScore = avg(previous, (x) =>
      typeof x.estimatedScore === "number" ? x.estimatedScore : null
    );
    const recentAccuracy = avg(recent, (x) => toAccuracy(x));
    const previousAccuracy = avg(previous, (x) => toAccuracy(x));
    const recentSpeed = avg(recent, (x) => toSpeed(x));
    const previousSpeed = avg(previous, (x) => toSpeed(x));

    const delta = (a: number | null, b: number | null) =>
      a != null && b != null ? Math.round((a - b) * 10) / 10 : null;

    return {
      scoreDelta: delta(recentScore, previousScore),
      accuracyDelta: delta(recentAccuracy, previousAccuracy),
      speedDelta: delta(recentSpeed, previousSpeed),
      hasEnough: recent.length >= 3 && previous.length >= 3,
    };
  }, [recentAttempts]);

  // learning behavior
  const lb = insights?.learning_behavior || null;

  const lbChips = useMemo(() => {
    if (!lb) return [];
    const chips: { label: string; variant?: "secondary" | "destructive" }[] =
      [];

    if (lb.cadence && lb.cadence !== "unknown") {
      chips.push({
        label: `Cadence: ${titleCase(lb.cadence)}`,
        variant: "secondary",
      });
    }
    if (lb.execution_style && lb.execution_style !== "unknown") {
      chips.push({
        label: `Execution: ${titleCase(lb.execution_style)}`,
        variant:
          lb.execution_style === "panic_cycle" ? "destructive" : "secondary",
      });
    }
    if (lb.responsiveness && lb.responsiveness !== "unknown") {
      chips.push({
        label: `Response: ${titleCase(lb.responsiveness)}`,
        variant: lb.responsiveness === "declining" ? "destructive" : "secondary",
      });
    }
    if (lb?.stuck_loop?.active && lb?.stuck_loop?.topic) {
      chips.push({
        label: `Stuck loop: ${lb.stuck_loop.topic}`,
        variant: "destructive",
      });
    }
    if (lb.confidence) {
      chips.push({
        label: `Signal confidence: ${titleCase(lb.confidence)}`,
        variant: "secondary",
      });
    }
    return chips.slice(0, 6);
  }, [lb]);

  const learningCurve = useMemo(() => {
    const raw = Array.isArray(insights?.learning_curve)
      ? (insights.learning_curve as LearningCurvePoint[])
      : [];
    return raw.map((p, idx) => ({
      index: Number(p?.index ?? idx + 1),
      xp: Number(p?.xp ?? 0),
      date: p?.date ?? null,
    }));
  }, [insights]);

  const curveValues = useMemo(
    () =>
      learningCurve
        .map((p) => (Number.isFinite(p.xp) ? Number(p.xp) : NaN))
        .filter((v) => !Number.isNaN(v)),
    [learningCurve]
  );

  const curveDelta = useMemo(() => {
    if (curveValues.length < 2) return 0;
    return Math.round(curveValues[curveValues.length - 1] - curveValues[0]);
  }, [curveValues]);

  const curveGradientId = useMemo(() => `curve-${id}`, [id]);

  const scoreDeltaLabel = useMemo(() => {
    const delta = learningState?.rollingDeltaScorePct ?? null;
    if (delta === null || delta === undefined) return null;
    return `${delta >= 0 ? "+" : ""}${delta} pts`;
  }, [learningState?.rollingDeltaScorePct]);

  const vibe = useMemo(() => {
    const conf = r?.estimated_score?.confidence;
    if (conf === "high") return "🔥 Locked in";
    if (conf === "medium") return "⚡ On the rise";
    return "🌱 Building momentum";
  }, [r]);

  const errorTaxonomy = useMemo(() => {
    const errorTypes = r?.error_types || {};
    const defs = [
      {
        key: "conceptual",
        label: "Conceptual misunderstanding",
        detail: "Gaps in core concepts or formulas.",
      },
      {
        key: "comprehension",
        label: "Misread / misinterpretation",
        detail: "Missing constraints or misreading the question intent.",
      },
      {
        key: "time",
        label: "Time pressure / speed",
        detail: "Running out of time or stuck too long on hard items.",
      },
      {
        key: "careless",
        label: "Calculation / careless",
        detail: "Silly mistakes, sign errors, or arithmetic slips.",
      },
    ];

    return defs
      .map((d) => ({
        ...d,
        value: Math.max(0, Math.min(100, Number((errorTypes as any)[d.key] || 0))),
      }))
      .sort((a, b) => b.value - a.value);
  }, [r]);

  const mainMistake = errorTaxonomy[0] || null;

  const whyItMatters = useMemo(() => {
    if (!mainMistake) return "Clear the top bottleneck to unlock easy score gains.";
    if (mainMistake.key === "time")
      return "Time pressure hides easy wins and drags accuracy late in the paper.";
    if (mainMistake.key === "careless")
      return "Careless errors are the fastest points to reclaim with a simple checklist.";
    if (mainMistake.key === "comprehension")
      return "Misreads burn time and create avoidable negatives—fixing this lifts accuracy fast.";
    return "Concept gaps compound across sections; closing them stabilizes your score floor.";
  }, [mainMistake]);

  const nextMockDateLabel = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + Number(nextMockInDays || 7));
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [nextMockInDays]);

  // --- Probe pack generation (deterministic, based on report) ---
  const probes: Probe[] = useMemo(() => {
    const weaknesses = Array.isArray(r?.weaknesses) ? r.weaknesses : [];
    const topWeak = weaknesses.slice(0, 2).map((w: any, i: number) => {
      const topic =
        String(w?.topic || `Weakness ${i + 1}`).trim() ||
        `Weakness ${i + 1}`;
      const sev = Number(w?.severity || 3);
      const mins = sev >= 4 ? 20 : 15;

      return {
        id: `topic_${i}_${topic.toLowerCase().replace(/\s+/g, "_").slice(0, 30)}`,
        type: "topic_drill" as const,
        title: `Topic drill: ${topic}`,
        minutes: mins,
        instructions: [
          `Do a focused set on ${topic} (10–20 questions).`,
          "Mark every wrong answer: why wrong? concept vs careless vs time.",
          "Write 3 takeaway rules (what you’ll do differently next time).",
        ],
        targetAccuracy: 75,
        why: "Topic drills rebuild accuracy on the weakest concepts.",
      };
    });

    const errorTypes = r?.error_types || {};
    const entries = Object.entries(errorTypes || {}).map(
      ([k, v]) => [k, Number(v || 0)] as const
    );
    const dominant = entries.length
      ? entries.sort((a, b) => (b[1] || 0) - (a[1] || 0))[0][0]
      : "";

    const execProbe: Probe = {
      id: `exec_${String(dominant || "balanced")}`,
      type: "execution_drill",
      title:
        dominant === "time"
          ? "Execution drill: Time checkpoints"
          : dominant === "careless"
          ? "Execution drill: Accuracy checkpoints"
          : dominant === "comprehension"
          ? "Execution drill: Read-first, solve-second"
          : "Execution drill: Balanced sprint",
      minutes: 15,
      instructions:
        dominant === "time"
          ? [
              "Do a 12-minute sprint: solve 8–10 medium questions.",
              "Checkpoint at 6 min: if stuck >60s, skip & return later.",
              "Goal: controlled skipping (no late panic).",
            ]
          : dominant === "careless"
          ? [
              "Do a slow-accuracy set: 8–10 easy/medium questions.",
              "Rule: before final answer, do a 5-second sanity check.",
              "Goal: reduce silly errors without killing speed.",
            ]
          : dominant === "comprehension"
          ? [
              "Do 6–8 questions with strict method: Read → rephrase → solve.",
              "Underline/mark key constraints before touching options.",
              "Goal: prevent misreads and trap attempts.",
            ]
          : [
              "Do a 10-minute sprint: 6–8 questions under a timer.",
              "After each, tag your error type (if wrong).",
              "Goal: stable execution under light time pressure.",
            ],
      targetAccuracy: 80,
      why: "Execution drills reduce time pressure and careless drops.",
    };

    const reviewProbe: Probe = {
      id: "review_mistakes",
      type: "review_drill",
      title: "Review drill: Error audit",
      minutes: 15,
      instructions: [
        "Pick 6 wrong questions from your mock.",
        "For each: write (1) why wrong, (2) correct method, (3) your rule.",
        "Goal: convert mistakes into repeatable rules.",
      ],
      targetAccuracy: 85,
      why: "Review drills lock corrections so the same errors don’t repeat.",
    };

    return [...topWeak, execProbe, reviewProbe].slice(0, 5);
  }, [r]);

  // ✅ Map of done probes from DB
  const doneMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    (progressDoc?.probes || []).forEach((p) => {
      m[p.id] = !!p.done;
    });
    return m;
  }, [progressDoc]);

  const doneCount = useMemo(
    () => probes.filter((p) => doneMap[p.id]).length,
    [probes, doneMap]
  );

  // ✅ OPTIONAL: Seed probe list into DB once (only if empty)
  useEffect(() => {
    if (!data?.exam || isSample) return;
    if (!probes.length) return;

    const existing = (progressDoc?.probes || []).length;
    if (existing) return;

    fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        exam: data.exam,
        probes: probes.map((p) => ({
          id: p.id,
          title: p.title,
          done: false,
          doneAt: null,
          tags: [p.type],
        })),
      }),
      })
      .then((r) => r.json())
      .then((j) => {
        if (j?.progress) setProgressDoc(j.progress);
      })
      .catch(() => {});
  }, [data?.exam, probes, progressDoc?.probes]);

  async function toggleProbeDone(probe: Probe, done: boolean) {
    if (!data?.exam || isSample) return;

    // optimistic UI
    setProgressDoc((prev) => {
      const base: ProgressDoc =
        prev ||
        ({
          exam: data.exam,
          nextMockInDays: 7,
          minutesPerDay: 40,
          probes: [],
          confidence: 0,
        } as any);

      const existing = (base.probes || []).slice();
      const idx = existing.findIndex((x) => x.id === probe.id);
      if (idx >= 0) {
        existing[idx] = {
          ...existing[idx],
          done,
          doneAt: done ? new Date().toISOString() : null,
        };
      } else {
        existing.push({
          id: probe.id,
          title: probe.title,
          done,
          doneAt: done ? new Date().toISOString() : null,
          tags: [probe.type],
        });
      }
      return { ...base, probes: existing };
    });

    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: data.exam,
          probe: { id: probe.id, title: probe.title, tags: [probe.type] },
          done,
        }),
      });
      const json = await res.json();
      if (res.ok) setProgressDoc(json?.progress || json || null);
    } catch {
      // ignore
    }
  }

  // ✅ Confidence score (computed in UI; we persist it to DB)
  const confidenceScore = useMemo(() => {
    // completion 0..50 + perf 0..30 + behavior 0..20
    const total = probes.length || 1;
    const completion = Math.round((doneCount / total) * 50);

    const doneProbes = probes.filter((p) => doneMap[p.id]);
    const doneMetrics = doneProbes.map((p) => probeMetrics[p.id] || {});
    let perf = 0;

    if (doneMetrics.length) {
      const accs = doneMetrics
        .map((x) =>
          Number.isFinite(Number(x.accuracy)) ? Number(x.accuracy) : NaN
        )
        .filter((n) => !Number.isNaN(n));
      const avgAcc = accs.length
        ? accs.reduce((a, b) => a + b, 0) / accs.length
        : 0;

      const confs = doneMetrics
        .map((x) =>
          Number.isFinite(Number(x.self_confidence))
            ? Number(x.self_confidence)
            : NaN
        )
        .filter((n) => !Number.isNaN(n));
      const avgSelf = confs.length
        ? confs.reduce((a, b) => a + b, 0) / confs.length
        : 0;

      const accPart = Math.round(
        (Math.max(0, Math.min(100, avgAcc)) / 100) * 20
      );
      const selfPart = Math.round((Math.max(0, Math.min(5, avgSelf)) / 5) * 10);
      perf = accPart + selfPart; // 0..30
    }

    let beh = 10; // neutral
    if (lb) {
      beh = 0;
      const cadence = String(lb.cadence || "");
      const resp = String(lb.responsiveness || "");
      const loop = !!lb?.stuck_loop?.active;

      if (cadence === "steady") beh += 8;
      if (cadence === "sporadic") beh += 4;
      if (cadence === "binge") beh += 3;

      if (resp === "improving") beh += 8;
      if (resp === "flat") beh += 5;
      if (resp === "declining") beh += 3;

      if (!loop) beh += 4;
    }
    beh = Math.max(0, Math.min(20, beh));

    return Math.max(0, Math.min(100, completion + perf + beh));
  }, [probes, doneCount, doneMap, probeMetrics, lb]);

  const confidenceLabel = useMemo(() => {
    if (confidenceScore >= 80) return "High";
    if (confidenceScore >= 60) return "Medium";
    if (confidenceScore >= 40) return "Building";
    return "Low";
  }, [confidenceScore]);

  // ✅ Persist confidence to DB (so History shows same number)
  useEffect(() => {
    if (!data?.exam) return;

    const t = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: data.exam,
          confidence: confidenceScore,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j?.progress) setProgressDoc(j.progress);
        })
        .catch(() => {});
    }, 500);

    return () => clearTimeout(t);
  }, [data?.exam, confidenceScore]);

  // ✅ Persist probe metrics to DB (so they survive device changes)
  useEffect(() => {
    if (!data?.exam) return;

    const t = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: data.exam,
          probeMetrics,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j?.progress) setProgressDoc(j.progress);
        })
        .catch(() => {});
    }, 600);

    return () => clearTimeout(t);
  }, [data?.exam, probeMetrics]);

  const nextMockStrategy = useMemo(() => {
    const base = Array.isArray(r?.next_mock_strategy)
      ? r.next_mock_strategy
      : [];
    const tweaks: string[] = [];

    if (lb) {
      const cadence = String(lb.cadence || "");
      const executionStyle = String(lb.execution_style || "");
      const responsiveness = String(lb.responsiveness || "");
      const stuckLoop = lb?.stuck_loop || {};

      if (cadence === "sporadic")
        tweaks.push(
          "Cadence has been sporadic—lock the next mock to a fixed day/time."
        );
      else if (cadence === "binge")
        tweaks.push("Avoid binge cycles—space mocks 2–3 days apart.");

      if (executionStyle === "panic_cycle")
        tweaks.push("Start slower: build accuracy in first 20% + checkpoints.");
      else if (executionStyle === "speed_over_control")
        tweaks.push("Add accuracy checkpoints: cap guesses + return later.");
      else if (executionStyle === "control_over_speed")
        tweaks.push("Inject 1–2 timed sprints to raise pace safely.");

      if (stuckLoop?.active && stuckLoop?.topic)
        tweaks.push(`Break loop on ${stuckLoop.topic}: drill it before next mock.`);
      if (responsiveness === "declining")
        tweaks.push("Do a micro-fix session before the full mock.");
    }

    let scheduleTweak: string | null = null;
    if (nextMockInDays <= 2)
      scheduleTweak = "Mock is very soon—micro-fix today + 1 timed sectional.";
    else if (nextMockInDays <= 4)
      scheduleTweak =
        "Short runway—fix top 2 weaknesses + 1 sectional, then full mock.";
    else if (nextMockInDays <= 7)
      scheduleTweak =
        "Use week: 2 sectionals + fix top 2 weaknesses before full mock.";
    else
      scheduleTweak =
        "Steady cadence: daily revise + weekly sectionals + full mock fixed day/time.";

    const uniqueTweaks = Array.from(new Set(tweaks)).slice(0, 2);
    const merged = [...base, ...uniqueTweaks];
    if (scheduleTweak) merged.push(scheduleTweak);

    return merged.slice(0, 8);
  }, [r, lb, nextMockInDays]);

  // ✅ Strategy engine meta + plan (from report.meta)
  const strategyPlan = useMemo(() => r?.meta?.strategy_plan || null, [r]);
  const detectedFrom = useMemo(() => detectedFromText(strategyPlan), [strategyPlan]);


  const strategyMeta = useMemo(() => {
    const sp = r?.meta?.strategy_plan;
    const s = r?.meta?.strategy;

    if (sp?.confidence) {
      return {
        score: Number(sp.confidence.score ?? 50),
        band: String(sp.confidence.band ?? "medium"),
        missing: Array.isArray(sp.confidence.missing_signals)
          ? sp.confidence.missing_signals
          : [],
        assumptions: Array.isArray(sp.confidence.assumptions)
          ? sp.confidence.assumptions
          : [],
      };
    }

    if (s) {
      return {
        score: Number(s.confidence_score ?? 50),
        band: String(s.confidence_band ?? "medium"),
        missing: Array.isArray(s.missing_signals) ? s.missing_signals : [],
        assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
      };
    }

    return { score: 50, band: "medium", missing: [], assumptions: [] };
  }, [r]);

  const bandBadge = useMemo(() => {
    const b = String(strategyMeta.band || "").toLowerCase();
    if (b === "low") return { label: "Low", variant: "destructive" as const };
    if (b === "high") return { label: "High", variant: "secondary" as const };
    return { label: "Medium", variant: "secondary" as const };
  }, [strategyMeta.band]);

  if (error) {
    return (
      <main className="min-h-screen p-6 flex justify-center items-center">
        <Card className="p-6 w-full max-w-xl space-y-4">
          <div className="text-lg font-semibold">Couldn’t load report</div>
          <div className="text-sm text-muted-foreground">{error}</div>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/")}>Back</Button>
            <Button variant="secondary" onClick={() => location.reload()}>
              Retry
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Note: if you restarted dev server, old links can 404.
          </div>
        </Card>
      </main>
    );
  }

  if (!data) return <div className="p-6">Loading...</div>;

  return (
    <main className="min-h-screen p-6 flex justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-5xl grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-3xl font-bold">Performance Diagnosis & Action Plan</div>
            <div className="text-sm text-muted-foreground">
              Exam: <span className="font-medium">{data.exam}</span> •{" "}
              <span className="font-medium">{vibe}</span>
              {progressLoading ? (
                <span className="ml-2 text-xs">• syncing…</span>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/history")}>
              Timeline
            </Button>
            <Button variant="secondary" onClick={() => router.push("/")}>
              Analyze another
            </Button>
          </div>
        </div>

        <Tabs value={tabValue} onValueChange={setTabValue} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="summary" className="flex-1">
              Summary
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex-1">
              Actions
            </TabsTrigger>
            <TabsTrigger value="evidence" className="flex-1">
              Evidence
            </TabsTrigger>
          </TabsList>

          {/* SUMMARY */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-5 rounded-2xl space-y-2">
                <div className="text-sm text-muted-foreground">Main mistake pattern</div>
                <div className="text-lg font-semibold">
                  {mainMistake?.label || "No dominant pattern yet"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {mainMistake
                    ? `${mainMistake.value}% of your recent errors · ${mainMistake.detail}`
                    : "Upload a few mocks to surface your dominant pattern."}
                </div>
              </Card>

              <Card className="p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-muted-foreground">Top 3 actions</div>
                  <Badge variant="secondary" className="rounded-full">
                    Ranked
                  </Badge>
                </div>
                {nextActions.length === 0 && !nextActionsLoading ? (
                  <div className="text-sm text-muted-foreground">
                    Run another mock to unlock personalized actions.
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {nextActions.slice(0, 3).map((action, idx) => (
                      <div key={action.id} className="rounded-xl border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">
                            {idx + 1}. {action.title}
                          </div>
                          <Badge
                            variant={action.expectedImpact === "High" ? "default" : "secondary"}
                            className="rounded-full"
                          >
                            {action.expectedImpact}
                          </Badge>
                        </div>
                        {action.evidence?.length ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            Recommended because your last mocks showed:{" "}
                            {action.evidence.slice(0, 2).join(", ")}.
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5 rounded-2xl space-y-2">
                <div className="text-sm text-muted-foreground">Next mock readiness</div>
                <div className="text-3xl font-bold">{confidenceScore}</div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{confidenceLabel} confidence</span>
                  <span>Next mock: {nextMockDateLabel}</span>
                </div>
                <Progress value={confidenceScore} />
              </Card>
            </div>

            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-slate-900">Why it matters:</span>{" "}
              {whyItMatters}
            </div>

            <Card className="p-5 space-y-3 rounded-2xl">
              <div className="text-lg font-semibold">Snapshot</div>
              <div className="text-sm">{r?.summary}</div>
            </Card>

            <Card className="p-5 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Accuracy confidence</div>
                  <div className="text-sm text-muted-foreground">
                    We calibrate recommendations using scorecard + intake signals. Missing
                    signals force a safer baseline.
                  </div>
                </div>
                <Badge variant={bandBadge.variant} className="rounded-full">
                  {bandBadge.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{strategyMeta.score}</div>
                {strategyMeta.missing?.length ? (
                  <Badge variant="secondary" className="rounded-full">
                    {strategyMeta.missing.length} missing signals
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="rounded-full">
                    Signals complete
                  </Badge>
                )}
              </div>
              <Progress value={strategyMeta.score} />

              {strategyMeta.assumptions?.length ? (
                <div className="text-sm">
                  <div className="font-medium mb-1">Assumptions used</div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {strategyMeta.assumptions
                      .slice(0, 6)
                      .map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card className="p-5 rounded-2xl space-y-3">
              <div className="text-lg font-semibold">Top insights</div>
              <div className="space-y-3">
                {(r?.weaknesses || []).slice(0, 3).map((w: any, i: number) => (
                  <div key={i} className="rounded-xl border p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{w.topic}</div>
                      <Badge variant="secondary">Severity {w.severity}/5</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {w.reason}
                    </div>
                  </div>
                ))}
                {(r?.weaknesses || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No weak spots detected yet. Upload more mock data for sharper insights.
                  </div>
                ) : null}
              </div>
            </Card>

            <ExamPatternChecklist
              exam={data.exam}
              title="Exam pattern checklist"
              subtitle="Advice is aligned to the official format, timing, and marking."
            />
          </TabsContent>

          {/* ACTIONS */}
          <TabsContent value="actions" className="space-y-4">
            {/* NEW: Strategy Plan V2 (if present) */}
            {strategyPlan ? (
              <Card className="p-5 rounded-2xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">🚀 Strategy Playbook</div>
                    <div className="text-sm text-muted-foreground">
                      Constrained levers + rules for your next attempt.
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {titleCase(String(strategyPlan?.confidence?.band || "medium"))} •{" "}
                    {Number(strategyPlan?.confidence?.score ?? 50)}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {(strategyPlan?.top_levers || []).map((lv: any, i: number) => (
                    <div key={i} className="rounded-xl border bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{lv.title}</div>

                          {detectedFrom ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              Detected from: {detectedFrom}
                            </div>
                          ) : null}
                         </div>

                        <Badge variant="secondary" className="rounded-full">
                          Lever {i + 1}
                        </Badge>
                      </div>


                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground mb-1">
                            DO
                          </div>
                          <ul className="list-disc pl-5 text-sm space-y-1">
                            {(lv.do || []).map((t: string, k: number) => (
                              <li key={k}>{t}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="text-xs text-muted-foreground mb-1">
                            STOP
                          </div>
                          <ul className="list-disc pl-5 text-sm space-y-1">
                            {(lv.stop || []).map((t: string, k: number) => (
                              <li key={k}>{t}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium text-slate-900">Why:</span>{" "}
                        {lv.why}
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Metric:</span>{" "}
                        <span className="text-muted-foreground">{lv.metric}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Next mock rule:</span>{" "}
                        <span className="text-muted-foreground">
                          {lv.next_mock_rule}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {Array.isArray(strategyPlan?.if_then_rules) &&
                strategyPlan.if_then_rules.length ? (
                  <div className="rounded-xl border bg-white p-4 space-y-2">
                    <div className="font-semibold">If–Then Rules</div>
                    <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                      {strategyPlan.if_then_rules
                        .slice(0, 10)
                        .map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {Array.isArray(strategyPlan?.next_questions) &&
                strategyPlan.next_questions.length ? (
                  <div className="rounded-xl border bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">Boost this plan</div>
                        <div className="text-sm text-muted-foreground">
                          Answer these to raise strategy confidence (we’ll wire auto re-run next).
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {strategyPlan.next_questions.length} questions
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {strategyPlan.next_questions.map((q: any) => (
                        <div key={q.id} className="space-y-1">
                          <div className="text-sm font-medium">{q.question}</div>
                          {Array.isArray(q.options) && q.options.length ? (
                            <div className="flex flex-wrap gap-2">
                              {q.options.map((opt: string) => (
                                <Button
                                  key={opt}
                                  type="button"
                                  variant={
                                    boostAnswers[q.id] === opt
                                      ? "default"
                                      : "secondary"
                                  }
                                  onClick={() =>
                                    setBoostAnswers((p) => ({ ...p, [q.id]: opt }))
                                  }
                                  className="rounded-full"
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <Input
                              value={boostAnswers[q.id] || ""}
                              onChange={(e) =>
                                setBoostAnswers((p) => ({
                                  ...p,
                                  [q.id]: e.target.value,
                                }))
                              }
                              placeholder="Type answer…"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Next: we’ll add a backend endpoint so these answers can re-run strategy for this attempt.
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card className="p-5 rounded-2xl space-y-2">
                <div className="text-lg font-semibold">🚀 Strategy Playbook</div>
                <div className="text-sm text-muted-foreground">
                  Strategy plan is not available for this attempt yet.
                </div>
                {r?.meta?.strategy_plan_error ? (
                  <div className="text-xs text-muted-foreground">
                    Error: {String(r.meta.strategy_plan_error).slice(0, 220)}
                  </div>
                ) : null}
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-1">
              {/* Confidence */}
              <Card className="p-5 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">🎯 Next Mock Confidence</div>
                    <div className="text-sm text-muted-foreground">
                      This rises when you complete probes + log results.
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-full">
                    {confidenceLabel}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{confidenceScore}</div>
                  <Badge variant="secondary" className="rounded-full">
                    {doneCount}/{probes.length} probes done
                  </Badge>
                </div>
                <Progress value={confidenceScore} />
                <div className="text-xs text-muted-foreground">
                  Rule: no probes done → score stays low. Completion + accuracy drives it up.
                </div>
              </Card>
            </div>

            {/* Planner */}
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">🗓️ Lock your next mock</div>
                  <div className="text-sm text-muted-foreground">
                    Tune the plan length + intensity. We’ll scale the daily tasks.
                  </div>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {minutesPerDay} min/day
                </Badge>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-xl border bg-white p-4 space-y-2">
                  <div className="text-sm font-medium">Next mock in</div>
                  <div className="flex flex-wrap gap-2">
                    {[2, 4, 7, 14].map((d) => (
                      <Button
                        key={d}
                        type="button"
                        variant={nextMockInDays === d ? "default" : "secondary"}
                        className="rounded-full"
                        onClick={() => savePlanner({ nextMockInDays: d })}
                      >
                        {d} days
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4 space-y-2">
                  <div className="text-sm font-medium">Minutes per day</div>
                  <div className="flex flex-wrap gap-2">
                    {[20, 40, 60, 90].map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={minutesPerDay === m ? "default" : "secondary"}
                        className="rounded-full"
                        onClick={() => savePlanner({ minutesPerDay: m })}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            {/* Ranked actions */}
            <Card className="p-5 rounded-2xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">🎯 Ranked Moves</div>
                  <div className="text-sm text-muted-foreground">
                    Three actions ranked by impact and recent signals.
                  </div>
                </div>
                {nextActionsLoading ? (
                  <Badge variant="secondary" className="rounded-full">
                    Loading
                  </Badge>
                ) : null}
              </div>

              {nextActions.length === 0 && !nextActionsLoading ? (
                <div className="text-sm text-muted-foreground">
                  No ranked moves yet. Run another mock to unlock personalized guidance.
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                {nextActions.map((action) => (
                  <Card key={action.id} className="p-4 space-y-3 border-dashed">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{action.title}</div>
                      <Badge
                        variant={action.expectedImpact === "High" ? "default" : "secondary"}
                        className="rounded-full"
                      >
                        {action.expectedImpact} impact
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Effort: {action.effort}
                    </div>

                    {action.metric ? (
                      <div className="text-xs text-muted-foreground">
                        Metric: {action.metric}
                      </div>
                    ) : null}

                    {action.evidence?.length ? (
                      <div className="text-xs text-muted-foreground">
                        Why this now: {action.evidence.slice(0, 2).join(", ")}.
                      </div>
                    ) : null}

                    {action.steps?.length ? (
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        {action.steps.slice(0, 3).map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    ) : null}

                    {action.evidence?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {action.evidence.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="rounded-full">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </Card>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="action-details">
                <AccordionTrigger>Show detail</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {/* Probes */}
                  <Card className="p-5 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">🧪 Probe Pack</div>
                        <div className="text-sm text-muted-foreground">
                          Complete these mini drills to raise confidence and improve next mock
                          execution.
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {doneCount}/{probes.length} done
                      </Badge>
                    </div>

                    <Accordion type="single" collapsible className="w-full">
                      {probes.map((p) => {
                        const done = !!doneMap[p.id];
                        const metrics = probeMetrics[p.id] || {};
                        return (
                          <AccordionItem key={p.id} value={p.id}>
                            <AccordionTrigger>
                              <div className="flex items-center gap-2">
                                <span>{p.title}</span>
                                <Badge
                                  variant={done ? "secondary" : "outline"}
                                  className="rounded-full"
                                >
                                  {done ? "Done" : `${p.minutes} min`}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-3">
                                <div className="text-sm text-muted-foreground">
                                  Target accuracy:{" "}
                                  <span className="font-medium text-slate-900">
                                    {p.targetAccuracy}%
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Why this matters: {p.why}
                                </div>

                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                  {p.instructions.map((t, i) => (
                                    <li key={i}>{t}</li>
                                  ))}
                                </ul>

                                <div className="grid md:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      Accuracy (%)
                                    </div>
                                    <Input
                                      inputMode="numeric"
                                      value={metrics.accuracy ?? ""}
                                      onChange={(e) =>
                                        setProbeMetric(p.id, {
                                          accuracy: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        })
                                      }
                                      placeholder="e.g., 70"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      Time (min)
                                    </div>
                                    <Input
                                      inputMode="numeric"
                                      value={metrics.time_min ?? ""}
                                      onChange={(e) =>
                                        setProbeMetric(p.id, {
                                          time_min: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        })
                                      }
                                      placeholder="e.g., 15"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">
                                      Self confidence (1–5)
                                    </div>
                                    <Input
                                      inputMode="numeric"
                                      value={metrics.self_confidence ?? ""}
                                      onChange={(e) =>
                                        setProbeMetric(p.id, {
                                          self_confidence: e.target.value
                                            ? Number(e.target.value)
                                            : undefined,
                                        })
                                      }
                                      placeholder="e.g., 4"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant={done ? "secondary" : "default"}
                                    onClick={() => toggleProbeDone(p, !done)}
                                  >
                                    {done ? "Mark as not done" : "Mark as done"}
                                  </Button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  Tip: enter metrics to increase confidence score faster.
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </Card>

                  {/* Next mock strategy (existing + behavior tweaks) */}
                  {!strategyPlan ? (
                    <Card className="p-5 rounded-2xl space-y-3">
                      <div className="text-lg font-semibold">📌 Next Mock Strategy</div>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        {nextMockStrategy.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </Card>
                  ) : null}

                  {/* Study plan */}
                  <Card className="p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">🗺️ Weekly Plan</div>
                        <div className="text-sm text-muted-foreground">
                          A weekly view first; daily details only when you need them.
                        </div>
                      </div>
                      <Badge variant="secondary" className="rounded-full">
                        {plannedDays} days
                      </Badge>
                    </div>

                    {weeklyPlan.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {weeklyPlan.map((week) => (
                          <div key={week.week} className="rounded-xl border bg-white p-4">
                            <div className="font-medium">Week {week.week}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Days {week.days[0]}–{week.days[week.days.length - 1]} •{" "}
                              {week.totalMinutes} min • {week.taskCount} tasks
                            </div>
                            {week.focus.length ? (
                              <div className="text-xs text-muted-foreground mt-2">
                                Focus: {week.focus.slice(0, 3).join(", ")}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No plan generated yet. Re-run analysis after backend update.
                      </div>
                    )}

                    {adjustedPlan.length ? (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="daily-plan">
                          <AccordionTrigger>Show daily detail</AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              {adjustedPlan.map((d: any) => (
                                <div
                                  key={d.day}
                                  className="rounded-lg border bg-white p-3"
                                >
                                  <div className="text-sm font-medium">
                                    Day {d.day} • {d.focus} • {d.time_minutes} min
                                  </div>
                                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1 mt-2">
                                    {(d.tasks || []).map((t: string, i: number) => (
                                      <li key={i}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : null}
                  </Card>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* EVIDENCE */}
          <TabsContent value="evidence" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="p-5 rounded-2xl space-y-3">
                <div className="text-lg font-semibold">Outcome deltas (last 3 mocks)</div>
                {outcomeDeltas.hasEnough ? (
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Score trend</span>
                      <span className="font-medium text-slate-900">
                        {outcomeDeltas.scoreDelta != null
                          ? `${outcomeDeltas.scoreDelta >= 0 ? "+" : ""}${outcomeDeltas.scoreDelta}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Accuracy control</span>
                      <span className="font-medium text-slate-900">
                        {outcomeDeltas.accuracyDelta != null
                          ? `${outcomeDeltas.accuracyDelta >= 0 ? "+" : ""}${outcomeDeltas.accuracyDelta}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Speed stability</span>
                      <span className="font-medium text-slate-900">
                        {outcomeDeltas.speedDelta != null
                          ? `${outcomeDeltas.speedDelta >= 0 ? "+" : ""}${outcomeDeltas.speedDelta}`
                          : "—"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Compared against the previous 3 mocks.
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Log at least 6 mocks to unlock outcome deltas.
                  </div>
                )}
              </Card>

              <Card className="p-5 rounded-2xl space-y-3">
                <div className="text-lg font-semibold">Error taxonomy (faculty lens)</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {errorTaxonomy.map((item) => (
                    <div key={item.key} className="rounded-xl border bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-900">{item.label}</div>
                        <Badge variant="secondary" className="rounded-full">
                          {item.value}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="evidence-detail">
                <AccordionTrigger>Show detail</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="p-5 rounded-2xl space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold">📈 Learning Curve</div>
                          <div className="text-sm text-muted-foreground">
                            Momentum across recent attempts (focus XP proxy).
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {titleCase(insights?.trend || "unknown")}
                        </Badge>
                      </div>

                      {curveValues.length ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-3xl font-bold">
                              {curveValues[curveValues.length - 1]}
                            </div>
                            <Badge
                              variant={curveDelta >= 0 ? "secondary" : "destructive"}
                              className="rounded-full"
                            >
                              {curveDelta >= 0 ? "+" : ""}
                              {curveDelta} since start
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className="rounded-full">
                              Rolling score: {learningState?.rollingScorePct ?? "—"}%
                            </Badge>
                            <Badge
                              variant={
                                scoreDeltaLabel && scoreDeltaLabel.startsWith("+")
                                  ? "secondary"
                                  : "outline"
                              }
                              className="rounded-full"
                            >
                              Rolling delta: {scoreDeltaLabel ?? "—"}
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                              Attempts: {learningState?.attemptCount ?? "—"}
                            </Badge>
                          </div>
                          <svg
                            viewBox="0 0 260 120"
                            role="img"
                            aria-label="Learning curve"
                            className="w-full h-28"
                          >
                            <defs>
                              <linearGradient
                                id={curveGradientId}
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#6366f1"
                                  stopOpacity="0.25"
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#ec4899"
                                  stopOpacity="0.6"
                                />
                              </linearGradient>
                            </defs>
                            <path
                              d={curvePath(curveValues, 260, 120, 16)}
                              fill="none"
                              stroke={`url(#${curveGradientId})`}
                              strokeWidth="3"
                            />
                          </svg>
                          <div className="text-xs text-muted-foreground">
                            {learningCurve.length} mocks • latest signal from your recent runs.
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {learningCurve.slice(-3).map((point, idx) => (
                              <Badge key={idx} variant="secondary" className="rounded-full">
                                Mock {point.index} • {point.xp ?? 0} XP
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Log at least 2 mocks to unlock the curve.
                        </div>
                      )}
                    </Card>

                    <Card className="p-5 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-lg font-semibold">🧭 Learning Behavior</div>
                          <div className="text-sm text-muted-foreground">
                            Signals your engine is picking up.
                          </div>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {titleCase(lb?.confidence || "unknown")}
                        </Badge>
                      </div>

                      {lb ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {lbChips.map((c, i) => (
                              <Badge
                                key={i}
                                variant={c.variant || "secondary"}
                                className="rounded-full"
                              >
                                {c.label}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Streak {lb.streak_days} days • {lb.weekly_activity}/wk • ΔXP{" "}
                            {lb.delta_xp ?? 0}
                          </div>
                          {Array.isArray(lb?.evidence) && lb.evidence.length ? (
                            <div className="text-sm">
                              <div className="font-medium mb-1">Signal evidence</div>
                              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                {lb.evidence.slice(0, 5).map((note: string, i: number) => (
                                  <li key={i}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Upload a few attempts to unlock behavior signals.
                        </div>
                      )}
                    </Card>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
        </div>

        <NextBestActionRail
          actions={nextActions}
          loading={nextActionsLoading}
          title="Next best action"
          emptyMessage="Analyze another mock to unlock your next best action."
          ctaLabel="Jump to Actions"
          onCtaClick={() => setTabValue("actions")}
        />
      </div>
    </main>
  );
}
