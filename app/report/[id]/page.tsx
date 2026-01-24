"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SectionHeader } from "@/components/section-header";
import { EmptyState } from "@/components/empty-state";
import { LoadingCard } from "@/components/loading-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import {
  ActionChecklist,
  type ActionChecklistItem,
} from "@/components/action-checklist";
import {
  sampleHistoryItems,
  sampleInsights,
  sampleLearningState,
  sampleNextActions,
  sampleProgressDoc,
  sampleReportPayload,
} from "@/lib/sampleData";
import { NextActionSchema } from "@/lib/schema";
import type { Insight, NextAction, Report } from "@/lib/types";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Sparkles,
  History,
  Wand2,
} from "lucide-react";

type ApiOk = {
  id: string;
  createdAt: string;
  exam: string;
  report: Report;
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

function parseMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/\\d+/);
  if (!match) return null;
  return Number(match[0]);
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

type PracticeMetric = {
  accuracy?: number;
  time_min?: number;
  score?: number;
  notes?: string;
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
  practiceMetrics?: Record<string, PracticeMetric>;
  sectionTimings?: Array<{
    section: string;
    minutes: number | null;
    order?: number | null;
    source?: "manual" | "ocr";
  }>;
  reminder?: {
    time?: string | null;
    channel?: "whatsapp" | "email" | "sms" | "push" | "none";
  };
  planAdherence?: Array<{ date: string; done: boolean }>;
  confidence: number; // 0..100 (we will write computed value here)
  updatedAt?: string;
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isSample = id === "sample";

  const [data, setData] = useState<ApiOk | null>(null);
  const [error, setError] = useState<string>("");

  const [insights, setInsights] = useState<Insight | null>(null);
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

  const localPracticeKey = useMemo(() => `cogniverse_practice_metrics_${id}`, [id]);
  const [practiceMetrics, setPracticeMetrics] = useState<
    Record<string, PracticeMetric>
  >({});

  const [sectionTimings, setSectionTimings] = useState<
    Array<{ section: string; minutes: number | null; order?: number | null }>
  >([]);

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

  // load local practice metrics
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(localPracticeKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") setPracticeMetrics(parsed);
    } catch {}
  }, [localPracticeKey]);

  // persist local practice metrics
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(localPracticeKey, JSON.stringify(practiceMetrics));
    } catch {}
  }, [localPracticeKey, practiceMetrics]);

  // hydrate probe metrics from DB (merge to preserve local edits)
  useEffect(() => {
    if (!progressDoc?.probeMetrics) return;
    setProbeMetrics((prev) => ({
      ...progressDoc.probeMetrics,
      ...prev,
    }));
  }, [progressDoc?.probeMetrics]);

  useEffect(() => {
    if (!progressDoc?.practiceMetrics) return;
    setPracticeMetrics((prev) => ({
      ...progressDoc.practiceMetrics,
      ...prev,
    }));
  }, [progressDoc?.practiceMetrics]);

  useEffect(() => {
    if (!progressDoc?.sectionTimings) return;
    setSectionTimings(progressDoc.sectionTimings);
  }, [progressDoc?.sectionTimings]);

  function setProbeMetric(probeId: string, patch: Partial<ProbeResultLocal>) {
    setProbeMetrics((prev) => ({
      ...prev,
      [probeId]: { ...(prev[probeId] || {}), ...patch },
    }));
  }

  function setPracticeMetric(setId: string, patch: Partial<PracticeMetric>) {
    setPracticeMetrics((prev) => ({
      ...prev,
      [setId]: { ...(prev[setId] || {}), ...patch },
    }));
  }

  function setSectionTiming(section: string, patch: { minutes?: number | null; order?: number | null }) {
    setSectionTimings((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((item) => item.section === section);
      const base = idx >= 0 ? next[idx] : { section, minutes: null, order: null };
      const updated = {
        ...base,
        minutes: patch.minutes !== undefined ? patch.minutes : base.minutes,
        order: patch.order !== undefined ? patch.order : base.order,
      };
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return next;
    });
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
  const normalizedActions = useMemo<NextAction[]>(() => {
    if (nextActions.length) return nextActions;
    const fallback = Array.isArray(r?.top_actions) ? r.top_actions : [];
    return fallback.map((title, index) => ({
      id: `action_${index}`,
      title,
      expectedImpact: "Medium",
      effort: "20 min",
      why: "A focused step that unlocks quick gains.",
      duration: "20 min",
      difficulty: "Medium",
    }));
  }, [nextActions, r?.top_actions]);

  const actionChecklistItems = useMemo<ActionChecklistItem[]>(() => {
    return normalizedActions.slice(0, 5).map((action) => ({
      id: action.id,
      title: action.title,
      why:
        action.why ||
        action.evidence?.[0] ||
        "This unlocks easy score gains with minimal effort.",
      duration: action.duration || action.effort,
      difficulty: action.difficulty || "Medium",
      steps: action.steps,
    }));
  }, [normalizedActions]);

  const reportConfidenceScore = Number(
    r?.meta?.strategy?.confidence_score ??
      r?.meta?.strategy_plan?.confidence?.score ??
      progressDoc?.confidence ??
      60
  );
  const reportConfidenceBand =
    r?.meta?.strategy?.confidence_band ??
    r?.meta?.strategy_plan?.confidence?.band ??
    "medium";

  const patterns = useMemo(() => {
    const weaknesses = Array.isArray(r?.weaknesses) ? r.weaknesses : [];
    return weaknesses.slice(0, 4).map((weakness) => ({
      topic: weakness.topic,
      reason: weakness.reason,
      severity: weakness.severity,
    }));
  }, [r?.weaknesses]);

  const summaryText =
    r?.summary ||
    "We’re still learning your patterns. Add another mock for sharper insights.";
  const scoreValue =
    r?.estimated_score?.value != null ? Math.round(r.estimated_score.value) : null;
  const scoreMax =
    r?.estimated_score?.max != null ? Math.round(r.estimated_score.max) : null;
  const scoreRange = Array.isArray(r?.estimated_score?.range)
    ? r?.estimated_score?.range
        ?.filter((val) => typeof val === "number")
        .map((val) => Math.round(val))
        .join("–")
    : null;
  const errorEntries = Object.entries(r?.error_types || {})
    .map(([key, value]) => ({ key, value: Number(value || 0) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);

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
          const parsed = NextActionSchema.array().safeParse(json?.actions || []);
          setNextActions(parsed.success ? parsed.data : []);
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

const probeAccuracyAvg = useMemo(() => {
  const values = Object.values(probeMetrics)
    .map((m) => Number(m?.accuracy))
    .filter((n) => Number.isFinite(n));
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}, [probeMetrics]);

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
const storyLine = useMemo(() => {
  const action = nextActions[0]?.title || "your next best action";
  const mistake = mainMistake?.label || "your main pattern";
  return `This week is about fixing ${mistake.toLowerCase()} and executing “${action}”.`;
}, [mainMistake, nextActions]);

const learningUpdateLines = useMemo(() => {
  const lines: string[] = [];
  if (probeAccuracyAvg != null) {
    lines.push(`Probe accuracy avg: ${probeAccuracyAvg}% (used to re-rank actions).`);
  }
  if (learningState?.rollingDeltaScorePct != null) {
    lines.push(
      `Rolling delta: ${learningState.rollingDeltaScorePct >= 0 ? "+" : ""}${
        learningState.rollingDeltaScorePct
      } points over recent mocks.`
    );
  }
  if (plannedDays && minutesPerDay) {
    lines.push(`Plan adapted to ${plannedDays} days at ${minutesPerDay} min/day for your next mock.`);
  }
  if (!lines.length) {
    lines.push("Add probe metrics to see the engine adapt your plan in real time.");
  }
  return lines.slice(0, 3);
}, [probeAccuracyAvg, learningState?.rollingDeltaScorePct, plannedDays, minutesPerDay]);

// --- Action checklist (seeded from next actions) ---
const probes: Probe[] = useMemo(() => {
  if (!actionChecklistItems.length) return [];
  return actionChecklistItems.map((action) => ({
    id: action.id,
    type: "execution_drill" as const,
    title: action.title,
    minutes: parseMinutes(action.duration) || 20,
    instructions:
      action.steps?.length && action.steps[0]
        ? action.steps
        : [
            "Work through the action with a timer on.",
            "Write 1 takeaway you can reuse in the next mock.",
          ],
    targetAccuracy: 80,
    why: action.why || "A focused action to unlock easy score gains.",
  }));
}, [actionChecklistItems]);

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

  const probeMap = useMemo(() => {
    const entries = probes.map((probe) => [probe.id, probe] as const);
    return Object.fromEntries(entries);
  }, [probes]);

  const completedToday = useMemo(() => {
    const today = dayKey(new Date());
    const doneToday = (progressDoc?.probes || []).filter(
      (probe) => probe.done && probe.doneAt && dayKey(new Date(probe.doneAt)) === today
    );
    const allowed = new Set(actionChecklistItems.map((item) => item.id));
    return doneToday.filter((probe) => allowed.has(probe.id)).length;
  }, [progressDoc, actionChecklistItems]);

  const streakCount = useMemo(() => {
    const completedDates = new Set(
      (progressDoc?.probes || [])
        .filter((probe) => probe.done && probe.doneAt)
        .map((probe) => dayKey(new Date(probe.doneAt as string)))
    );
    let count = 0;
    const cursor = new Date();
    while (completedDates.has(dayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [progressDoc]);

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

  // ✅ Persist practice metrics to DB (drill outcomes)
  useEffect(() => {
    if (!data?.exam) return;

    const t = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: data.exam,
          practiceMetrics,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j?.progress) setProgressDoc(j.progress);
        })
        .catch(() => {});
    }, 650);

    return () => clearTimeout(t);
  }, [data?.exam, practiceMetrics]);

  // ✅ Persist section timing data for timing coach
  useEffect(() => {
    if (!data?.exam) return;
    if (!sectionTimings.length) return;

    const t = setTimeout(() => {
      fetch("/api/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exam: data.exam,
          sectionTimings,
        }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j?.progress) setProgressDoc(j.progress);
        })
        .catch(() => {});
    }, 700);

    return () => clearTimeout(t);
  }, [data?.exam, sectionTimings]);

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
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            title="Report not ready"
            description={error}
            icon={<ClipboardList className="h-5 w-5" />}
            actionLabel="Back to upload"
            onAction={() => router.push("/")}
          />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <LoadingCard lines={4} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Report"
            title={`${data.exam} mock summary`}
            description="Cognitive snapshot + confidence badge so you know what to do next."
            action={
              <Button variant="outline" size="sm" onClick={() => router.push("/history")}>
                View history
              </Button>
            }
          />
          <Card className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                Attempt #{learningState?.attemptCount ?? 1}
              </Badge>
              <ConfidenceBadge score={reportConfidenceScore} band={reportConfidenceBand} />
              {scoreRange ? (
                <Badge variant="outline" className="rounded-full">
                  Projected {scoreRange}
                </Badge>
              ) : null}
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900">{summaryText}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Estimated score
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {scoreValue != null ? scoreValue : "—"}
                  {scoreMax ? ` / ${scoreMax}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Confidence: {reportConfidenceBand}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Strongest signal
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {r?.strengths?.[0] || "Keep logging mocks for sharper signals"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Based on your latest attempt
                </p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Focus XP
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {r?.meta?.focusXP ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Your weekly momentum</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Patterns"
            description="The habits showing up across your mock."
          />
          {patterns.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {patterns.map((pattern) => (
                <Card key={pattern.topic} className="rounded-2xl border bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-semibold text-slate-900">{pattern.topic}</p>
                    <Badge variant="secondary" className="rounded-full">
                      Severity {pattern.severity}/5
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{pattern.reason}</p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No patterns yet"
              description="Upload another mock to surface clear patterns in your performance."
              icon={<Sparkles className="h-5 w-5" />}
              actionLabel="Analyze another mock"
              onAction={() => router.push("/")}
            />
          )}

          {errorEntries.length ? (
            <Card className="rounded-2xl border bg-white p-5">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  Error split (micro view)
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {errorEntries.map((entry) => (
                    <div key={entry.key} className="rounded-xl border bg-white p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900">
                          {titleCase(entry.key)}
                        </span>
                        <span className="text-xs text-muted-foreground">{entry.value}%</span>
                      </div>
                      <div className="mt-2">
                        <Progress value={entry.value} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.45fr]">
          <div className="space-y-6">
            <div className="space-y-4">
              <SectionHeader
                title="Next best actions"
                description="Three focused moves to lift your score this week."
                action={
                  <Button variant="outline" size="sm" onClick={() => router.push("/history")}
                  >
                    See timeline <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
              {normalizedActions.length ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {normalizedActions.slice(0, 3).map((action) => (
                    <Card key={action.id} className="rounded-2xl border bg-white p-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-semibold text-slate-900">{action.title}</p>
                        {action.expectedImpact ? (
                          <Badge variant="secondary" className="rounded-full">
                            {action.expectedImpact} impact
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {action.why || action.evidence?.[0] || "Small change, big payoff."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {action.duration || action.effort ? (
                          <Badge variant="outline" className="rounded-full">
                            {action.duration || action.effort}
                          </Badge>
                        ) : null}
                        {action.difficulty ? (
                          <Badge variant="outline" className="rounded-full">
                            {action.difficulty}
                          </Badge>
                        ) : null}
                      </div>
                      {action.steps?.length ? (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                          {action.steps.slice(0, 2).map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Actions are loading"
                  description="We’ll surface your next best actions as soon as the report finishes."
                  icon={<Wand2 className="h-5 w-5" />}
                />
              )}
            </div>

            <div className="space-y-4">
              <SectionHeader
                title="Next mock strategy"
                description="A quick script to carry into your next attempt."
              />
              <Card className="rounded-2xl border bg-white p-5">
                {Array.isArray(r?.next_mock_strategy) && r?.next_mock_strategy.length ? (
                  <ol className="space-y-2 text-sm text-slate-900">
                    {r.next_mock_strategy.slice(0, 5).map((line, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{idx + 1}</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Log another mock to unlock your personalized next-mock script.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push("/")}
                  >
                    Upload another mock
                  </Button>
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <SectionHeader
                title="History + delta"
                description="How your last attempts are trending."
              />
              <Card className="rounded-2xl border bg-white p-5">
                {recentAttempts.length ? (
                  <div className="space-y-3">
                    {recentAttempts.slice(0, 4).map((attempt) => (
                      <div key={attempt.id} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{attempt.summary || "Mock"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(attempt.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {attempt.estimatedScore ?? "—"}
                        </Badge>
                      </div>
                    ))}
                    <div className="mt-3 rounded-xl border bg-slate-50 p-3 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Last delta</span>
                        <span className="font-medium text-slate-900">
                          {learningState?.lastDeltaScorePct != null
                            ? `${learningState.lastDeltaScorePct >= 0 ? "+" : ""}${learningState.lastDeltaScorePct} pts`
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rolling average</span>
                        <span className="font-medium text-slate-900">
                          {learningState?.rollingScorePct != null
                            ? `${learningState.rollingScorePct}%`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No history yet"
                    description="Run another mock to track your score trends over time."
                    icon={<History className="h-5 w-5" />}
                    actionLabel="Analyze a mock"
                    onAction={() => router.push("/")}
                  />
                )}
              </Card>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6">
            <ActionChecklist
              items={actionChecklistItems}
              completedIds={doneMap}
              completedToday={Math.min(completedToday, 3)}
              streakCount={streakCount}
              onToggle={(id, nextDone) => {
                const probe = probeMap[id];
                if (probe) {
                  toggleProbeDone(probe, nextDone);
                }
              }}
              onStart={() => {
                toast.message("Action started. You’ve got this.");
              }}
            />
            <Card className="rounded-2xl border bg-white p-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Sparkles className="h-4 w-4" />
                Keep the streak alive
              </div>
              <p className="mt-2">
                Check off even one action a day to keep your momentum score climbing.
              </p>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
