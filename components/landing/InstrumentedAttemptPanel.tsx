"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InstrumentDraft,
  InstrumentQuestionLog,
  InstrumentTemplate,
} from "@/lib/instrument/types";
import type { AnalyzeResponse, StateSnapshot } from "@/lib/contracts";

const STORAGE_KEYS = {
  draft: "cv.instrument.draft.v1",
  lastReport: "cv.lastReport.v1",
  lastStateSnapshot: "cv.lastStateSnapshot.v1",
};

const PRESETS: Array<{ id: string; label: string; template: InstrumentTemplate }> = [
  { id: "preset-a", label: "2 sections × 20 Q · 60 min", template: { sectionCount: 2, questionsPerSection: 20, totalTimeMin: 60 } },
  { id: "preset-b", label: "3 sections × 15 Q · 75 min", template: { sectionCount: 3, questionsPerSection: 15, totalTimeMin: 75 } },
  { id: "preset-c", label: "1 section × 30 Q · 45 min", template: { sectionCount: 1, questionsPerSection: 30, totalTimeMin: 45 } },
];

const DEFAULT_LOG: Omit<InstrumentQuestionLog, "sectionIndex" | "questionIndex" | "updatedAt"> = {
  status: "attempted",
  confidence: "med",
  correctness: "unknown",
  timeSpentSec: 0,
  errorType: "unknown",
};

function formatTime(seconds: number) {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function createQuestionKey(sectionIndex: number, questionIndex: number) {
  return `${sectionIndex}:${questionIndex}`;
}

type InstrumentedAttemptPanelProps = {
  onReport: (report: AnalyzeResponse) => void;
  onLoadingChange: (loading: boolean) => void;
};

export function InstrumentedAttemptPanel({
  onReport,
  onLoadingChange,
}: InstrumentedAttemptPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].id);
  const [draft, setDraft] = useState<InstrumentDraft | null>(null);
  const [resumeDraft, setResumeDraft] = useState<InstrumentDraft | null>(null);
  const [stateSnapshot, setStateSnapshot] = useState<StateSnapshot | null>(null);
  const [activeQuestionKey, setActiveQuestionKey] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventRef = useRef<InstrumentQuestionLog | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAuthed = useMemo(() => {
    if (!stateSnapshot?.userId) return false;
    return !stateSnapshot.userId.startsWith("anon_");
  }, [stateSnapshot?.userId]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.draft);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as InstrumentDraft;
        if (parsed?.attemptId) {
          setResumeDraft(parsed);
        }
      } catch {
        setResumeDraft(null);
      }
    }
    const storedSnapshot = localStorage.getItem(STORAGE_KEYS.lastStateSnapshot);
    if (storedSnapshot) {
      try {
        setStateSnapshot(JSON.parse(storedSnapshot) as StateSnapshot);
      } catch {
        setStateSnapshot(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!draft) return;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(draft));
    }, 400);
  }, [draft]);

  useEffect(() => {
    if (!draft?.timer.running) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setDraft((current) => {
        if (!current?.timer.running) return current;
        const nextRemaining = current.timer.remainingSec - 1;
        const activeKey = current.activeQuestionKey;
        if (activeKey) {
          const existing = current.questions[activeKey];
          const nextLog: InstrumentQuestionLog = existing
            ? { ...existing, timeSpentSec: existing.timeSpentSec + 1, updatedAt: new Date().toISOString() }
            : {
                sectionIndex: Number(activeKey.split(":")[0]),
                questionIndex: Number(activeKey.split(":")[1]),
                ...DEFAULT_LOG,
                timeSpentSec: 1,
                updatedAt: new Date().toISOString(),
              };
          return {
            ...current,
            questions: { ...current.questions, [activeKey]: nextLog },
            timer: {
              ...current.timer,
              remainingSec: nextRemaining,
              lastTickAt: new Date().toISOString(),
            },
          };
        }
        return {
          ...current,
          timer: {
            ...current.timer,
            remainingSec: nextRemaining,
            lastTickAt: new Date().toISOString(),
          },
        };
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [draft?.timer.running]);

  const activeLog = useMemo(() => {
    if (!draft || !activeQuestionKey) return null;
    const existing = draft.questions[activeQuestionKey];
    if (existing) return existing;
    const [sectionStr, questionStr] = activeQuestionKey.split(":");
    return {
      sectionIndex: Number(sectionStr),
      questionIndex: Number(questionStr),
      ...DEFAULT_LOG,
      updatedAt: new Date().toISOString(),
    } satisfies InstrumentQuestionLog;
  }, [draft, activeQuestionKey]);

  const currentTemplate = useMemo(() => {
    return PRESETS.find((preset) => preset.id === selectedPreset)?.template ?? PRESETS[0].template;
  }, [selectedPreset]);

  const handleStart = async (template: InstrumentTemplate) => {
    onLoadingChange(true);
    try {
      const res = await fetch("/api/instrument/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const payload = await res.json().catch(() => null);
      const attemptId = payload?.attemptId ?? "";
      const snapshot = payload?.stateSnapshot as StateSnapshot | null;

      const now = new Date().toISOString();
      const nextDraft: InstrumentDraft = {
        attemptId,
        template,
        startedAt: now,
        totalTimeSec: template.totalTimeMin * 60,
        activeSectionIndex: 0,
        activeQuestionKey: createQuestionKey(0, 0),
        questions: {},
        timer: {
          running: true,
          remainingSec: template.totalTimeMin * 60,
          lastTickAt: now,
        },
      };

      setDraft(nextDraft);
      setActiveQuestionKey(nextDraft.activeQuestionKey ?? null);
      setStateSnapshot(snapshot);
      setResumeDraft(null);
      localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(nextDraft));
      if (snapshot) {
        localStorage.setItem(STORAGE_KEYS.lastStateSnapshot, JSON.stringify(snapshot));
      }
    } catch {
      // ignore
    } finally {
      onLoadingChange(false);
    }
  };

  const queueQuestionEvent = (log: InstrumentQuestionLog) => {
    pendingEventRef.current = log;
    if (eventTimeoutRef.current) {
      clearTimeout(eventTimeoutRef.current);
    }
    eventTimeoutRef.current = setTimeout(async () => {
      if (!pendingEventRef.current || !draft?.attemptId || !isAuthed) {
        return;
      }
      try {
        const res = await fetch("/api/instrument/event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attemptId: draft.attemptId,
            event: {
              type: "instrument_question_updated",
              payload: pendingEventRef.current,
            },
          }),
        });
        const payload = await res.json().catch(() => null);
        if (payload?.stateSnapshot) {
          setStateSnapshot(payload.stateSnapshot as StateSnapshot);
          localStorage.setItem(STORAGE_KEYS.lastStateSnapshot, JSON.stringify(payload.stateSnapshot));
        }
      } catch {
        // ignore
      }
    }, 500);
  };

  const updateQuestionLog = (partial: Partial<InstrumentQuestionLog>) => {
    if (!draft || !activeQuestionKey) return;
    const existing = draft.questions[activeQuestionKey];
    const [sectionStr, questionStr] = activeQuestionKey.split(":");
    const baseLog: InstrumentQuestionLog =
      existing ??
      ({
        sectionIndex: Number(sectionStr),
        questionIndex: Number(questionStr),
        ...DEFAULT_LOG,
        updatedAt: new Date().toISOString(),
      } satisfies InstrumentQuestionLog);

    const nextLog: InstrumentQuestionLog = {
      ...baseLog,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    const nextDraft: InstrumentDraft = {
      ...draft,
      questions: { ...draft.questions, [activeQuestionKey]: nextLog },
    };
    setDraft(nextDraft);
    queueQuestionEvent(nextLog);
  };

  const handleSelectQuestion = (sectionIndex: number, questionIndex: number) => {
    const key = createQuestionKey(sectionIndex, questionIndex);
    setActiveQuestionKey(key);
    setDraft((current) =>
      current ? { ...current, activeSectionIndex: sectionIndex, activeQuestionKey: key } : current
    );
  };

  const handleFinish = async () => {
    if (!draft) return;
    onLoadingChange(true);
    try {
      const res = await fetch("/api/instrument/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: draft.attemptId,
          template: draft.template,
          questions: Object.values(draft.questions),
          timer: {
            remainingSec: draft.timer.remainingSec,
            totalTimeSec: draft.totalTimeSec,
          },
          stateSnapshot,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (payload) {
        onReport(payload as AnalyzeResponse);
        localStorage.setItem(STORAGE_KEYS.lastReport, JSON.stringify(payload));
        if (payload.stateSnapshot) {
          localStorage.setItem(STORAGE_KEYS.lastStateSnapshot, JSON.stringify(payload.stateSnapshot));
        }
        localStorage.removeItem(STORAGE_KEYS.draft);
        setDraft(null);
      }
    } catch {
      // ignore
    } finally {
      onLoadingChange(false);
    }
  };

  const handleResume = () => {
    if (!resumeDraft) return;
    setDraft(resumeDraft);
    setActiveQuestionKey(resumeDraft.activeQuestionKey ?? null);
    setResumeDraft(null);
  };

  const handleDiscardResume = () => {
    setResumeDraft(null);
    localStorage.removeItem(STORAGE_KEYS.draft);
  };

  return (
    <section className="surface-card space-y-6 p-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold">Instrumented Attempt</h2>
        <p className="text-sm text-muted-foreground">
          Run a timed, exam-agnostic attempt. Log each question and generate the same report output as Quick Analyze.
        </p>
      </header>

      {resumeDraft && !draft ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
          <p className="font-semibold text-foreground">Resume saved attempt?</p>
          <p className="mt-1 text-muted-foreground">
            {resumeDraft.template.sectionCount} sections · {resumeDraft.template.questionsPerSection} Q each ·{" "}
            {resumeDraft.template.totalTimeMin} min remaining {formatTime(resumeDraft.timer.remainingSec)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleResume}>
              Resume attempt
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleDiscardResume}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      {!draft ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preset">Choose a template</Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger id="preset">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => handleStart(currentTemplate)}>
            Start instrumented attempt
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">Timer</p>
              <p className="text-xl font-semibold">{formatTime(draft.timer.remainingSec)}</p>
              <p className="text-xs text-muted-foreground">
                Total {draft.template.totalTimeMin} min · {draft.template.sectionCount} sections
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          timer: { ...current.timer, running: !current.timer.running },
                        }
                      : current
                  )
                }
              >
                {draft.timer.running ? "Pause" : "Resume"}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: draft.template.sectionCount }, (_, idx) => (
              <Button
                key={`section-${idx}`}
                type="button"
                size="sm"
                variant={draft.activeSectionIndex === idx ? "default" : "secondary"}
                onClick={() => {
                  const key = createQuestionKey(idx, 0);
                  setDraft((current) =>
                    current ? { ...current, activeSectionIndex: idx, activeQuestionKey: key } : current
                  );
                  setActiveQuestionKey(key);
                }}
              >
                Section {idx + 1}
              </Button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-muted-foreground">Question grid</p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-10">
                {Array.from({ length: draft.template.questionsPerSection }, (_, idx) => {
                  const key = createQuestionKey(draft.activeSectionIndex, idx);
                  const log = draft.questions[key];
                  const status = log?.status ?? "attempted";
                  const correctness = log?.correctness ?? "unknown";
                  const isActive = key === activeQuestionKey;
                  const badge =
                    correctness === "correct"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : correctness === "incorrect"
                        ? "bg-rose-500/20 text-rose-200"
                        : status === "skipped"
                          ? "bg-muted/70 text-muted-foreground"
                          : "bg-amber-500/20 text-amber-200";

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-md px-2 py-1 text-xs ${badge} ${isActive ? "ring-2 ring-primary" : ""}`}
                      onClick={() => handleSelectQuestion(draft.activeSectionIndex, idx)}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
              <div>
                <p className="text-sm font-semibold">Selected question</p>
                <p className="text-xs text-muted-foreground">
                  {activeLog ? `Section ${activeLog.sectionIndex + 1} · Q${activeLog.questionIndex + 1}` : "Select a question"}
                </p>
              </div>

              {activeLog ? (
                <div className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <p className="font-medium">Status</p>
                    <div className="flex flex-wrap gap-2">
                      {(["attempted", "skipped"] as const).map((status) => (
                        <Button
                          key={status}
                          type="button"
                          size="sm"
                          variant={activeLog.status === status ? "default" : "secondary"}
                          onClick={() => updateQuestionLog({ status })}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Confidence</p>
                    <div className="flex flex-wrap gap-2">
                      {(["low", "med", "high"] as const).map((confidence) => (
                        <Button
                          key={confidence}
                          type="button"
                          size="sm"
                          variant={activeLog.confidence === confidence ? "default" : "secondary"}
                          onClick={() => updateQuestionLog({ confidence })}
                        >
                          {confidence}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium">Correctness</p>
                    <div className="flex flex-wrap gap-2">
                      {(["correct", "incorrect", "unknown"] as const).map((correctness) => (
                        <Button
                          key={correctness}
                          type="button"
                          size="sm"
                          variant={activeLog.correctness === correctness ? "default" : "secondary"}
                          onClick={() => updateQuestionLog({ correctness })}
                        >
                          {correctness}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {activeLog.correctness === "incorrect" ? (
                    <div className="space-y-2">
                      <Label htmlFor="errorType">Error type</Label>
                      <Select
                        value={activeLog.errorType ?? "unknown"}
                        onValueChange={(value) =>
                          updateQuestionLog({
                            errorType: value as InstrumentQuestionLog["errorType"],
                          })
                        }
                      >
                        <SelectTrigger id="errorType">
                          <SelectValue placeholder="Select error type" />
                        </SelectTrigger>
                        <SelectContent>
                          {["concept", "time", "careless", "selection", "unknown"].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="timeSpent">Time spent (seconds)</Label>
                    <Input
                      id="timeSpent"
                      type="number"
                      min={0}
                      value={activeLog.timeSpentSec}
                      onChange={(event) =>
                        updateQuestionLog({
                          timeSpentSec: Number(event.target.value || 0),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-tracking adds time while the timer runs. Adjust if needed.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={handleFinish}>
              Finish attempt
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDraft(null);
                localStorage.removeItem(STORAGE_KEYS.draft);
              }}
            >
              End without report
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
