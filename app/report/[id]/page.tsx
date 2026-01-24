"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeader } from "@/components/section-header";
import { SectionCard } from "@/components/section-card";
import { EmptyState } from "@/components/empty-state";
import { StatPill } from "@/components/stat-pill";
import { sampleReportPayload } from "@/lib/sampleData";
import { formatExamLabel } from "@/lib/exams";
import { trackEvent } from "@/lib/analytics";
import type { CoachMode } from "@/lib/contracts";
import {
  fetchWithTimeout,
  isAbortError,
  readJsonSafely,
  withFriendlyTimeoutMessage,
} from "@/lib/fetcher";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  HelpCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";

type ReportPayload = {
  id: string;
  createdAt: string;
  exam: string;
  report: any;
};

type HistoryItem = {
  id: string;
  createdAt: string;
  focusXP?: number;
  summary?: string;
};

type FollowupAnswer = {
  id: string;
  value: string;
};

const EMPTY_REPORT = {
  summary: "No report data available.",
  facts: { metrics: [], notes: [] },
  inferences: [],
  patterns: [],
  next_actions: [],
  strategy: { next_mock_script: [], attempt_rules: [] },
  followups: [],
  meta: {},
};

const SIGNAL_LABELS: Record<string, string> = {
  key_metrics: "Key metrics",
  execution_patterns: "Execution patterns",
  next_mock_timeline: "Next mock timeline",
  daily_minutes: "Daily study minutes",
  biggest_struggle: "Primary struggle",
  time_pressure: "Time pressure signal",
};

const SIGNAL_TOTAL = 6;

function storageKey(prefix: string, reportId: string) {
  return `${prefix}:${reportId}`;
}

function actionSlug(title: string, idx: number) {
  const base =
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `action-${idx + 1}`;
  return base.slice(0, 64);
}

function loadStoredState<T>(key: string, fallback: T) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveStoredState(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

function computeQualityScore(missingSignals: string[]) {
  if (!missingSignals.length) return 100;
  const missing = Math.min(SIGNAL_TOTAL, missingSignals.length);
  return Math.max(0, Math.round(100 - (missing / SIGNAL_TOTAL) * 100));
}

function qualityBand(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 50) return "medium" as const;
  return "low" as const;
}

function bandTone(band: string) {
  if (band === "high") return "default" as const;
  if (band === "medium") return "warning" as const;
  return "warning" as const;
}

function missingSignalLabels(missingSignals: string[]) {
  return missingSignals.map(
    (signal) => SIGNAL_LABELS[signal] || signal.replaceAll("_", " ")
  );
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();

  // ✅ Next.js App Router: params is async in Client Components
  const { id: reportId } = React.use(params);

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<ReportPayload | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [followupAnswers, setFollowupAnswers] = useState<Record<string, string>>(
    {}
  );
  const [completedActions, setCompletedActions] = useState<
    Record<string, boolean>
  >({});
  const [actionReflections, setActionReflections] = useState<Record<string, string>>({});
  const [coachMode, setCoachMode] = useState<CoachMode>("explain_report");
  const [coachMessage, setCoachMessage] = useState("");
  const [coachConversationId, setCoachConversationId] = useState("");
  const [coachMessages, setCoachMessages] = useState<
    Array<{ role: string; content: string; citations: Array<{ label: string }> }>
  >([]);
  const [coachLoading, setCoachLoading] = useState(false);

  const isSample = reportId === "sample";

  useEffect(() => {
    const completedKey = storageKey("cogniverse_actions", reportId);
    const reflectionKey = storageKey("cogniverse_action_reflections", reportId);
    const followupKey = storageKey("cogniverse_followups", reportId);
    setCompletedActions(loadStoredState(completedKey, {}));
    setActionReflections(loadStoredState(reflectionKey, {}));
    setFollowupAnswers(loadStoredState(followupKey, {}));
  }, [reportId]);

  useEffect(() => {
    setCoachConversationId("");
    setCoachMessages([]);
    setCoachMessage("");
    setCoachMode("explain_report");
  }, [reportId]);

  useEffect(() => {
    saveStoredState(storageKey("cogniverse_actions", reportId), completedActions);
  }, [completedActions, reportId]);

  useEffect(() => {
    saveStoredState(storageKey("cogniverse_action_reflections", reportId), actionReflections);
  }, [actionReflections, reportId]);

  useEffect(() => {
    saveStoredState(storageKey("cogniverse_followups", reportId), followupAnswers);
  }, [followupAnswers, reportId]);

  useEffect(() => {
    let active = true;

    async function loadReport() {
      setLoading(true);

      if (isSample) {
        setReportData(sampleReportPayload as ReportPayload);
        setLoading(false);
        return;
      }

      try {
        const res = await fetchWithTimeout(`/api/report/${reportId}`, {
          timeoutMs: 8000,
        });
        const json = await readJsonSafely<ReportPayload & { error?: string }>(res);

        if (!json) throw new Error("Report response was empty.");
        if (!res.ok) throw new Error(json.error || "Failed to load report.");
        if (!active) return;
        setReportData(json);
      } catch (error: unknown) {
        if (!active) return;
        const message =
          isAbortError(error)
            ? "This report is taking longer than expected. Please retry."
            : withFriendlyTimeoutMessage(
                error instanceof Error
                  ? error.message
                  : "Failed to load report.",
                "This report is taking longer than expected. Please retry."
              );
        toast.error(message);
        setReportData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [reportId, isSample]);

  useEffect(() => {
    if (isSample) return;
    let active = true;
    setHistoryLoading(true);

    fetchWithTimeout("/api/history?limit=6", { timeoutMs: 8000 })
      .then(async (res) => {
        const json = await readJsonSafely<
          { items?: HistoryItem[] } & { error?: string }
        >(res);
        if (!active) return;
        if (!res.ok) throw new Error(json?.error || "Failed to load history.");
        setHistoryItems(Array.isArray(json?.items) ? json.items : []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message =
          isAbortError(error)
            ? "History is slow right now. Showing this attempt only."
            : "History is unavailable right now.";
        toast.message(message);
        setHistoryItems([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSample]);

  useEffect(() => {
    if (isSample || !reportData?.id) return;
    let active = true;

    fetchWithTimeout(`/api/actions?attemptId=${reportData.id}`, { timeoutMs: 8000 })
      .then(async (res) => {
        const json = await readJsonSafely<{ states?: any[] } & { error?: string }>(res);
        if (!active || !res.ok) return;
        const states = Array.isArray(json?.states) ? json.states : [];
        const completed: Record<string, boolean> = {};
        const reflections: Record<string, string> = {};
        states.forEach((state: any) => {
          const id = String(state?.actionId || "");
          if (!id) return;
          completed[id] = String(state?.status || "pending") === "completed";
          reflections[id] = String(state?.reflection || "");
        });
        setCompletedActions((prev) => ({ ...prev, ...completed }));
        setActionReflections((prev) => ({ ...prev, ...reflections }));
      })
      .catch(() => {
        // best-effort sync; local storage remains the fallback
      });

    return () => {
      active = false;
    };
  }, [isSample, reportData?.id]);

  const report = reportData?.report || EMPTY_REPORT;
  const examLabel = formatExamLabel(reportData?.exam);

  const confidenceBand = report?.meta?.strategy?.confidence_band || "low";
  const confidenceScore = Number.isFinite(Number(report?.meta?.strategy?.confidence_score))
    ? Number(report?.meta?.strategy?.confidence_score)
    : null;

  const missingSignals = Array.isArray(report?.meta?.strategy?.missing_signals)
    ? report.meta.strategy.missing_signals
    : [];

  const qualityScore = computeQualityScore(missingSignals);
  const qualityLevel = qualityBand(qualityScore);
  const missingLabels = missingSignalLabels(missingSignals);

  const completionRate = useMemo(() => {
    const actions = report?.next_actions || [];
    if (!actions.length) return 0;
    const doneCount = actions.filter((action: any, idx: number) => {
      const actionId = actionSlug(action?.title, idx);
      return completedActions[actionId];
    }).length;
    return Math.round((doneCount / actions.length) * 100);
  }, [completedActions, report?.next_actions]);

  const topBottleneck = report?.patterns?.[0]?.title || null;
  const fastestWin = report?.next_actions?.[0]?.title || null;

  const deltaFocus = useMemo(() => {
    if (historyItems.length < 2) return null;
    const latest = Number(historyItems[0]?.focusXP || 0);
    const prev = Number(historyItems[1]?.focusXP || 0);
    if (!Number.isFinite(latest) || !Number.isFinite(prev)) return null;
    return latest - prev;
  }, [historyItems]);

  const attemptsTracked = historyItems.length;

  const consistencyScore = confidenceScore;
  const riskScore = confidenceScore != null ? Math.max(0, 100 - confidenceScore) : null;

  useEffect(() => {
    if (!reportData || isSample) return;
    trackEvent("ui_viewed_report", {
      attemptId: reportId,
      metadata: { exam: reportData.exam },
    });
  }, [reportData, reportId, isSample]);

  async function exportReport() {
    try {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cogniverse_report_${reportId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      trackEvent("export_clicked", {
        attemptId: reportId,
        metadata: { format: "json" },
      });
    } catch {
      toast.error("Export failed. Please retry.");
    }
  }

  async function handleFollowupSubmit() {
    const answers: FollowupAnswer[] = Object.entries(followupAnswers)
      .filter(([id, value]) => id && value.trim().length > 0)
      .map(([id, value]) => ({ id, value }));

    if (!answers.length) {
      toast.message("Add at least one answer.");
      return;
    }

    trackEvent("followup_answered", { attemptId: reportId, metadata: { answers } });
    toast.success("Thanks! We saved your answers on this device.");
  }

  const coachModeOptions: Array<{ id: CoachMode; label: string }> = [
    { id: "explain_report", label: "Explain my report" },
    { id: "focus_today", label: "Focus today" },
    { id: "score_not_improving", label: "Why no improvement?" },
    { id: "next_mock_strategy", label: "Next mock plan" },
    { id: "am_i_improving", label: "Am I improving?" },
  ];

  async function persistAction(params: {
    actionId: string;
    title: string;
    status: "pending" | "completed";
    reflection?: string;
  }) {
    const res = await fetchWithTimeout("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId: reportId,
        actionId: params.actionId,
        title: params.title,
        status: params.status,
        reflection: params.reflection,
      }),
      timeoutMs: 8000,
    });
    const json = await readJsonSafely<{ error?: string }>(res);
    if (!res.ok) throw new Error(json?.error || "Failed to save action state.");
    return json;
  }

  async function toggleAction(actionId: string, title: string) {
    const nextCompleted = !completedActions[actionId];
    setCompletedActions((prev) => ({ ...prev, [actionId]: nextCompleted }));

    try {
      await persistAction({
        actionId,
        title,
        status: nextCompleted ? "completed" : "pending",
        reflection: actionReflections[actionId],
      });
      if (nextCompleted) {
        trackEvent("action_completed", {
          attemptId: reportId,
          metadata: { actionId, action: title },
        });
      }
    } catch (error: any) {
      setCompletedActions((prev) => ({ ...prev, [actionId]: !nextCompleted }));
      toast.error(error?.message || "Could not update action.");
    }
  }

  async function saveReflection(actionId: string, title: string) {
    try {
      await persistAction({
        actionId,
        title,
        status: completedActions[actionId] ? "completed" : "pending",
        reflection: actionReflections[actionId],
      });
      toast.success("Reflection saved.");
    } catch (error: any) {
      toast.error(error?.message || "Could not save reflection.");
    }
  }

  async function sendCoachMessage() {
    if (isSample) {
      toast.message("Coach is disabled on the sample report.");
      return;
    }
    if (!reportData?.id) {
      toast.error("Report context missing.");
      return;
    }

    setCoachLoading(true);
    try {
      const res = await fetchWithTimeout("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: reportId,
          mode: coachMode,
          message: coachMessage.trim() || undefined,
          conversationId: coachConversationId || undefined,
        }),
        timeoutMs: 15000,
      });
      const json = await readJsonSafely<any>(res);
      if (!res.ok) throw new Error(json?.error || "Coach request failed.");

      if (json?.conversation?.conversationId) {
        setCoachConversationId(String(json.conversation.conversationId));
      }
      if (Array.isArray(json?.messages)) {
        setCoachMessages(json.messages);
      }
      setCoachMessage("");
    } catch (error: any) {
      toast.error(error?.message || "Coach is unavailable right now.");
    } finally {
      setCoachLoading(false);
    }
  }

  function onNavigate(path: string, label: string) {
    trackEvent("ui_clicked_cta", { attemptId: reportId, metadata: { path, label } });
    router.push(path);
  }

  const allSections = [
    "summary",
    "patterns",
    "actions",
    "coach",
    "strategy",
    "history",
    "followups",
    "facts",
    "inferences",
  ];

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <SectionCard>
          <div className="text-sm text-muted-foreground">Loading report…</div>
        </SectionCard>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <SectionCard>
          <EmptyState
            title="We couldn't load this report"
            description="The report may have expired or the server is temporarily unavailable."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => onNavigate("/", "retry_upload")}
              >
                Upload another attempt
              </Button>
            }
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900">Performance report</h1>
          <p className="text-sm text-muted-foreground">
            Clear next steps based on your latest attempt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {examLabel ? <Badge variant="secondary">{examLabel}</Badge> : null}
          <Badge variant="outline" className="capitalize">
            Confidence: {confidenceBand}
          </Badge>
          {confidenceScore !== null ? (
            <Badge variant="outline">Score: {confidenceScore}</Badge>
          ) : null}
          <Button variant="outline" onClick={exportReport} className="gap-2">
            <Download className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <SectionCard>
            <SectionHeader
              title="Hero summary"
              description="A single-screen view of confidence, input quality, and the most important callouts."
              action={
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Live status
                </div>
              }
            />
            <p className="text-base text-slate-900">{report.summary}</p>

            <div className="grid gap-3 md:grid-cols-3">
              <StatPill
                label="Input quality"
                value={`${qualityScore}%`}
                hint={`Signal coverage is ${qualityLevel}.`}
                tone={bandTone(qualityLevel)}
              />
              <StatPill
                label="Top bottleneck"
                value={topBottleneck || "Not enough data yet"}
                hint="Highest-impact friction from this attempt."
                tone={topBottleneck ? "warning" : "default"}
              />
              <StatPill
                label="Fastest win"
                value={fastestWin || "Not enough data yet"}
                hint="Smallest move with the best immediate payoff."
                tone={fastestWin ? "positive" : "default"}
              />
            </div>

            {missingLabels.length ? (
              <EmptyState
                title="Signals still missing"
                description={`Add these for higher-confidence strategy: ${missingLabels.join(
                  ", "
                )}.`}
              />
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Consistency
                </div>
                {consistencyScore != null ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-semibold">{consistencyScore}</div>
                      <Badge variant="outline">/ 100</Badge>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-all"
                        style={{ width: `${consistencyScore}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Not enough data yet.
                  </div>
                )}
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Risk
                </div>
                {riskScore != null ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-semibold">{riskScore}</div>
                      <Badge variant="outline">/ 100</Badge>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-amber-500 transition-all"
                        style={{ width: `${riskScore}%` }}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Risk is computed as the inverse of confidence while signals are sparse.
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Not enough data yet.
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard contentClassName="space-y-2">
            <SectionHeader
              title="Execution workflow"
              description="Each section is collapsible but open by default so you can move top-to-bottom."
            />
            <Accordion type="multiple" defaultValue={allSections} className="space-y-3">
              <AccordionItem value="patterns" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Patterns
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    These are the repeatable behaviors affecting your score the most.
                  </p>
                  {report.patterns?.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {report.patterns.map((pattern: any, idx: number) => (
                        <div key={`${pattern.title}-${idx}`} className="rounded-xl border p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <Sparkles className="h-4 w-4" /> {pattern.title}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            <span className="font-medium">Evidence:</span> {pattern.evidence}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Impact:</span> {pattern.impact}
                          </p>
                          <p className="text-sm text-slate-900">
                            <span className="font-medium">Fix:</span> {pattern.fix}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No patterns detected yet"
                      description="Upload a fuller scorecard or add manual metrics to surface patterns."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="actions" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Next actions
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Complete these before the next mock. Progress syncs to your coach and institute.
                  </p>
                  {report.next_actions?.length ? (
                    <div className="space-y-3">
                      {report.next_actions.map((action: any, idx: number) => {
                        const actionId = actionSlug(action?.title, idx);
                        const completed = completedActions[actionId];
                        return (
                          <div key={`${action.title}-${idx}`} className="rounded-xl border p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-900">
                                  {action.title}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {action.duration} · {action.expected_impact}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={completed ? "default" : "outline"}
                                onClick={() => toggleAction(actionId, action.title)}
                              >
                                {completed ? "Done" : "Mark done"}
                              </Button>
                            </div>
                            {action.steps?.length ? (
                              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                                {action.steps.map((step: string, sIdx: number) => (
                                  <li key={`${action.title}-${sIdx}`}>{step}</li>
                                ))}
                              </ul>
                            ) : null}
                            {completed ? (
                              <div className="mt-3 space-y-2">
                                <div className="text-xs font-medium text-slate-700">
                                  Reflection (what changed when you tried this?)
                                </div>
                                <textarea
                                  className="min-h-[80px] w-full rounded-lg border border-slate-200 bg-white p-2 text-sm"
                                  value={actionReflections[actionId] || ""}
                                  onChange={(e) =>
                                    setActionReflections((prev) => ({
                                      ...prev,
                                      [actionId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Example: I stopped guessing in QA and my accuracy felt calmer."
                                />
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => saveReflection(actionId, action.title)}
                                  >
                                    Save reflection
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title="No actions yet"
                      description="We need clearer patterns to recommend the best next actions."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="coach" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  AI coach
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  <p className="text-sm text-muted-foreground">
                    The coach responds only to evidence from this report, your past attempts,
                    and your completed actions.
                  </p>
                  <div className="grid gap-2 md:grid-cols-3">
                    {coachModeOptions.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        size="sm"
                        variant={coachMode === option.id ? "default" : "outline"}
                        onClick={() => setCoachMode(option.id)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <Input
                      value={coachMessage}
                      onChange={(e) => setCoachMessage(e.target.value)}
                      placeholder="Optional: add context (e.g., I panicked in section 2)."
                    />
                    <Button type="button" onClick={sendCoachMessage} disabled={coachLoading}>
                      {coachLoading ? "Coaching..." : "Ask coach"}
                    </Button>
                  </div>
                  {coachMessages.length ? (
                    <div className="space-y-2">
                      {coachMessages.map((message, idx) => (
                        <div key={`${message.role}-${idx}`} className="rounded-xl border p-3">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">
                            {message.role === "coach" ? "Coach" : "You"}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                            {message.content}
                          </div>
                          {Array.isArray(message.citations) && message.citations.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {message.citations.map((citation: any, cIdx: number) => (
                                <Badge key={`${citation.label}-${cIdx}`} variant="secondary">
                                  {citation.label}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Coach is ready"
                      description="Pick a mode above to receive grounded next steps."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="strategy" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Strategy
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Use this as your execution script during the next attempt.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border p-4">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Attempt script
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-900">
                        {report.strategy?.next_mock_script?.length ? (
                          report.strategy.next_mock_script.map((item: string, idx: number) => (
                            <li key={`script-${idx}`}>{item}</li>
                          ))
                        ) : (
                          <li>No script available yet.</li>
                        )}
                      </ul>
                    </div>
                    <div className="rounded-xl border p-4">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Attempt rules
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-900">
                        {report.strategy?.attempt_rules?.length ? (
                          report.strategy.attempt_rules.map((rule: string, idx: number) => (
                            <li key={`rule-${idx}`}>{rule}</li>
                          ))
                        ) : (
                          <li>No attempt rules yet.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="history" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  History & delta
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    We compare this attempt against recent history when it is available.
                  </p>
                  {historyLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading recent attempts…
                    </div>
                  ) : attemptsTracked >= 2 ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <StatPill
                        label="Attempts tracked"
                        value={attemptsTracked}
                        hint="Recent attempts used for context."
                      />
                      <StatPill
                        label="Focus delta"
                        value={
                          deltaFocus != null
                            ? `${deltaFocus > 0 ? "+" : ""}${deltaFocus}`
                            : "0"
                        }
                        hint="Change vs previous attempt."
                        tone={deltaFocus != null && deltaFocus > 0 ? "positive" : "default"}
                      />
                      <StatPill
                        label="Momentum"
                        value={deltaFocus != null && deltaFocus > 0 ? "Improving" : "Needs push"}
                        hint="Derived from focus delta only."
                      />
                    </div>
                  ) : (
                    <EmptyState
                      title="Not enough data yet"
                      description="Complete at least two attempts to unlock meaningful deltas."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="followups" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Follow-ups
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Answering follow-ups reduces assumptions and improves input quality.
                  </p>
                  {report.followups?.length ? (
                    <div className="space-y-3">
                      {report.followups.map((followup: any, idx: number) => (
                        <div key={`${followup.id}-${idx}`} className="space-y-2">
                          <div className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                            <HelpCircle className="mt-0.5 h-4 w-4 text-indigo-600" />
                            {followup.question}
                          </div>
                          <Input
                            value={followupAnswers[followup.id] || ""}
                            onChange={(e) =>
                              setFollowupAnswers((prev) => ({
                                ...prev,
                                [followup.id]: e.target.value,
                              }))
                            }
                            placeholder={followup.type === "text" ? "Type your answer" : "Answer"}
                          />
                          <p className="text-xs text-muted-foreground">{followup.reason}</p>
                        </div>
                      ))}
                      <Button onClick={handleFollowupSubmit} className="w-full" type="button">
                        Save follow-up answers
                      </Button>
                    </div>
                  ) : (
                    <EmptyState
                      title="No follow-ups needed"
                      description="You already have enough signal coverage for this attempt."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="facts" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Facts
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    These metrics come directly from your scorecard text.
                  </p>
                  {report.facts?.metrics?.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {report.facts.metrics.map((metric: any) => (
                        <div key={metric.label} className="rounded-xl border p-3">
                          <div className="text-sm font-semibold text-slate-900">{metric.label}</div>
                          <div className="text-lg font-bold text-indigo-700">{metric.value}</div>
                          <div className="text-xs text-muted-foreground">{metric.evidence}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No solid metrics extracted"
                      description="Add manual metrics to improve the quality of the analysis."
                    />
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="inferences" className="rounded-xl border px-4">
                <AccordionTrigger className="py-3 text-base font-semibold">
                  Inferences
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="mb-3 text-sm text-muted-foreground">
                    Hypotheses are confidence-banded so you know what to verify.
                  </p>
                  {report.inferences?.length ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {report.inferences.map((item: any, idx: number) => (
                        <div key={`${item.hypothesis}-${idx}`} className="rounded-xl border p-3">
                          <div className="flex items-center justify-between text-sm font-semibold">
                            <span>{item.hypothesis}</span>
                            <Badge variant="outline" className="capitalize">
                              {item.confidence}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{item.evidence}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="No inferences yet" description="We need more signal coverage." />
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <SectionCard contentClassName="space-y-3">
            <SectionHeader title="Next actions" description="Your execution checklist for the next mock." />
            <div className="grid gap-2">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-muted-foreground">Completion</div>
                <div className="mt-1 flex items-end justify-between">
                  <div className="text-2xl font-semibold">{completionRate}%</div>
                  <Badge variant="secondary" className="gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Momentum
                  </Badge>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-900" style={{ width: `${completionRate}%` }} />
                </div>
              </div>

              {report.next_actions?.length ? (
                <div className="rounded-xl border p-3 text-sm">
                  <div className="font-semibold text-slate-900">Top action</div>
                  <div className="text-muted-foreground">{report.next_actions[0].title}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {report.next_actions[0].duration} · {report.next_actions[0].expected_impact}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No actions available"
                  description="Run another attempt to unlock a clear next action."
                />
              )}
            </div>

            <div className="grid gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => onNavigate("/history", "view_history")}
              >
                <ClipboardList className="mr-2 h-4 w-4" /> View attempt history
              </Button>
              <Button type="button" className="gap-2" onClick={() => onNavigate("/", "upload_next_attempt")}>
                Upload next attempt <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
