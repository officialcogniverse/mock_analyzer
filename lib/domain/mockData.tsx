"use client";

import * as React from "react";
import { nanoid } from "nanoid";

import type {
  CogniverseState,
  IntakeFormState,
  Note,
  PlanDay,
  PlanTask,
  Report,
  TuneStrategyAnswers,
} from "./types";
import { deriveTodayPlan } from "./selectors";

const STORAGE_KEY = "cogniverse.mock.state";

const defaultIntake: IntakeFormState = {
  examLabel: "",
  goal: "Accuracy",
  nextMockDays: "7",
  weeklyHours: "10-20",
  biggestStruggle: "Running out of time",
};

const basePlanTasks: PlanTask[] = [
  {
    id: "task-time-box",
    actionId: "action-time-box",
    title: "Time-box 2 sets with checkpoints",
    durationMinutes: 45,
    type: "drill",
    why: "You gain speed when you pre-commit exit points.",
    tags: ["Speed", "Decision"],
  },
  {
    id: "task-error-log",
    actionId: "action-error-log",
    title: "Convert misses into a 12-card error log",
    durationMinutes: 35,
    type: "review",
    why: "Reduces repeat mistakes in high-frequency patterns.",
    tags: ["Accuracy", "Revision"],
  },
  {
    id: "task-pressure-reps",
    actionId: "action-pressure-reps",
    title: "Run a 25-min pressure rep with no pausing",
    durationMinutes: 25,
    type: "drill",
    why: "Simulates mock stress and enforces selection discipline.",
    tags: ["Stress", "Selection"],
  },
  {
    id: "task-reset",
    title: "2-minute breathing reset + reflection",
    durationMinutes: 10,
    type: "recovery",
    why: "Restores focus and prevents cascading mistakes.",
    tags: ["Recovery"],
  },
];

const createBaseReport = (): Report => {
  const generatedAt = new Date().toISOString();

  return {
    id: "report-cat-001",
    generatedAt,
    goal: "Accuracy",
    streakDays: 6,
    weeklyCompletion: [
      { day: "Mon", completed: 3 },
      { day: "Tue", completed: 4 },
      { day: "Wed", completed: 2 },
      { day: "Thu", completed: 5 },
      { day: "Fri", completed: 4 },
      { day: "Sat", completed: 3 },
      { day: "Sun", completed: 2 },
    ],
    confidenceHistory: [
      { label: "Mock 1", confidence: 52 },
      { label: "Mock 2", confidence: 63 },
      { label: "Mock 3", confidence: 74 },
    ],
    attempts: [
      {
        id: "attempt-1",
        examLabel: "CAT",
        date: "2026-01-04",
        score: 58,
        accuracy: 62,
        speed: 54,
        risk: 68,
        consistency: 51,
        timeTakenMinutes: 120,
        percentile: 78,
        sections: [
          { name: "VARC", accuracy: 66, speed: 58, attempts: 24, correct: 16 },
          { name: "DILR", accuracy: 59, speed: 49, attempts: 20, correct: 12 },
          { name: "QA", accuracy: 61, speed: 55, attempts: 22, correct: 13 },
        ],
        notes: "Panicked in DILR set 3; guessed QA last 10 minutes.",
      },
      {
        id: "attempt-2",
        examLabel: "CAT",
        date: "2026-01-11",
        score: 64,
        accuracy: 68,
        speed: 59,
        risk: 62,
        consistency: 57,
        timeTakenMinutes: 120,
        percentile: 84,
        sections: [
          { name: "VARC", accuracy: 71, speed: 61, attempts: 24, correct: 17 },
          { name: "DILR", accuracy: 63, speed: 54, attempts: 20, correct: 13 },
          { name: "QA", accuracy: 66, speed: 60, attempts: 22, correct: 15 },
        ],
        notes: "Better selection but still overcommitted to one hard set.",
      },
      {
        id: "attempt-3",
        examLabel: "CAT",
        date: "2026-01-18",
        score: 71,
        accuracy: 73,
        speed: 64,
        risk: 56,
        consistency: 66,
        timeTakenMinutes: 120,
        percentile: 90,
        sections: [
          { name: "VARC", accuracy: 76, speed: 66, attempts: 24, correct: 18 },
          { name: "DILR", accuracy: 69, speed: 61, attempts: 20, correct: 14 },
          { name: "QA", accuracy: 72, speed: 65, attempts: 22, correct: 16 },
        ],
        notes: "Time-boxing helped; still slow in QA algebra cluster.",
      },
    ],
    currentAttemptId: "attempt-3",
    patterns: [
      {
        id: "pattern-time-sink",
        title: "Time sink on mid-difficulty sets",
        severity: "high",
        evidence: "You spent 38% of time on sets with 55-65% accuracy.",
        fix: "Add a 6-minute exit rule and re-enter later with fresh context.",
        tags: ["Speed", "Selection"],
      },
      {
        id: "pattern-careless-rush",
        title: "Late-section careless rush",
        severity: "critical",
        evidence: "Accuracy drops from 76% to 58% after minute 90.",
        fix: "Insert a 90-second reset at the 2/3 mark to slow the spiral.",
        tags: ["Accuracy", "Stress"],
      },
      {
        id: "pattern-qa-algebra",
        title: "Algebra transitions cost momentum",
        severity: "medium",
        evidence: "QA algebra cluster accuracy sits at 61% despite high attempts.",
        fix: "Drill algebra templates in 12-minute sprints with solution recall.",
        tags: ["Concepts", "QA"],
        isHypothesis: true,
      },
      {
        id: "pattern-variance",
        title: "High variance between sections",
        severity: "medium",
        evidence: "VARC accuracy is +7 pts higher than DILR on average.",
        fix: "Front-load one confident DILR set to stabilize early momentum.",
        tags: ["Consistency"],
      },
      {
        id: "pattern-risk-taper",
        title: "Risk taking is improving",
        severity: "low",
        evidence: "Risk score is down 12 pts across the last 3 mocks.",
        fix: "Keep the skip discipline and only guess when odds are 2:1.",
        tags: ["Risk"],
      },
      {
        id: "pattern-overreview",
        title: "Over-reviewing correct answers",
        severity: "medium",
        evidence: "You spent 11 minutes re-checking correct VARC questions.",
        fix: "Mark-and-move: allow one pass only unless flagged as uncertain.",
        tags: ["Speed", "Decision"],
        isHypothesis: true,
      },
    ],
    actions: [
      {
        id: "action-time-box",
        title: "Run a 6-minute exit rule drill",
        summary: "Practice walking away from mid-difficulty traps without FOMO.",
        durationMinutes: 45,
        difficulty: "Focused",
        whyThisHelps:
          "It converts wasted time into high-yield attempts and keeps accuracy stable.",
        steps: [
          { id: "step-1", label: "Pick 2 sets you usually overcommit to." },
          { id: "step-2", label: "Set a 6-minute timer and force an exit." },
          { id: "step-3", label: "Re-enter only after finishing your easy bank." },
        ],
        tags: ["Speed", "Selection"],
        relatedPatternIds: ["pattern-time-sink", "pattern-overreview"],
        energy: "medium",
        impact: 88,
      },
      {
        id: "action-error-log",
        title: "Build a 12-card error log",
        summary: "Turn misses into tiny flashcards you can revise in 10 minutes.",
        durationMinutes: 35,
        difficulty: "Easy win",
        whyThisHelps:
          "You fix repeat errors faster when the review loop is short and visual.",
        steps: [
          { id: "step-4", label: "Pick the top 6 misses by frequency." },
          { id: "step-5", label: "Write the trap in one line." },
          { id: "step-6", label: "Add the correct trigger and a check question." },
        ],
        tags: ["Accuracy", "Revision"],
        relatedPatternIds: ["pattern-careless-rush", "pattern-qa-algebra"],
        energy: "low",
        impact: 82,
        isCompleted: true,
      },
      {
        id: "action-pressure-reps",
        title: "25-minute pressure reps",
        summary: "Simulate mock stress with strict time and zero pauses.",
        durationMinutes: 25,
        difficulty: "Deep work",
        whyThisHelps:
          "Stress-proof reps reduce late-section accuracy dips and improve decision speed.",
        steps: [
          { id: "step-7", label: "Choose one mixed set of 12 questions." },
          { id: "step-8", label: "Start the timer and ban solution peeking." },
          { id: "step-9", label: "Review only after time ends; log every guess." },
        ],
        tags: ["Stress", "Decision"],
        relatedPatternIds: ["pattern-careless-rush", "pattern-variance"],
        energy: "high",
        impact: 91,
      },
    ],
    plan: [
      {
        id: "plan-day-1",
        dayIndex: 1,
        label: "Day 1",
        date: "2026-01-19",
        focus: "Stabilize selection discipline",
        milestone: "Accuracy Stabilized",
        status: "completed",
        energyHint: "medium",
        tasks: basePlanTasks.map((task, index) => ({
          ...task,
          id: `${task.id}-d1-${index}`,
          completed: index !== 0,
        })),
      },
      {
        id: "plan-day-2",
        dayIndex: 2,
        label: "Day 2",
        date: "2026-01-20",
        focus: "Speed checkpoints + resets",
        status: "completed",
        energyHint: "high",
        tasks: basePlanTasks.map((task, index) => ({
          ...task,
          id: `${task.id}-d2-${index}`,
          completed: true,
        })),
      },
      {
        id: "plan-day-3",
        dayIndex: 3,
        label: "Day 3",
        date: "2026-01-21",
        focus: "Pressure reps + algebra templates",
        milestone: "Speed checkpoint",
        status: "current",
        energyHint: "high",
        tasks: basePlanTasks.map((task, index) => ({
          ...task,
          id: `${task.id}-d3-${index}`,
          completed: index < 2,
          tags: index === 0 ? [...task.tags, "DILR"] : task.tags,
        })),
      },
      {
        id: "plan-day-4",
        dayIndex: 4,
        label: "Day 4",
        date: "2026-01-22",
        focus: "Recovery + recall",
        status: "upcoming",
        energyHint: "low",
        tasks: basePlanTasks.map((task, index) => ({
          ...task,
          id: `${task.id}-d4-${index}`,
          completed: false,
          type: index === 3 ? "recovery" : task.type,
        })),
      },
      {
        id: "plan-day-5",
        dayIndex: 5,
        label: "Day 5",
        date: "2026-01-23",
        focus: "Mock day rehearsal",
        milestone: "Mock Day",
        status: "upcoming",
        energyHint: "high",
        tasks: [
          {
            id: "task-mini-mock",
            title: "75-minute mini mock",
            durationMinutes: 75,
            type: "mock",
            why: "Rehearses timing splits before the full mock.",
            tags: ["Mock", "Timing"],
          },
          {
            id: "task-mock-review",
            title: "Rapid review + action log",
            durationMinutes: 35,
            type: "review",
            why: "Converts the rehearsal into next-best actions quickly.",
            tags: ["Review"],
          },
        ],
      },
    ],
    notes: [
      {
        id: "note-1",
        createdAt: "2026-01-21T07:20:00.000Z",
        title: "Exit rule script",
        body: "If I am not 60% sure by minute 6, I mark, move, and re-enter after the easy bank.",
        tags: ["Selection", "Speed"],
        linkedActionId: "action-time-box",
        isPinned: true,
      },
      {
        id: "note-2",
        createdAt: "2026-01-20T16:35:00.000Z",
        title: "Reset trigger",
        body: "At the 2/3 mark: breathe out for 6 seconds, roll shoulders, and read the next question twice.",
        tags: ["Stress", "Accuracy"],
        linkedActionId: "action-pressure-reps",
      },
      {
        id: "note-3",
        createdAt: "2026-01-19T19:05:00.000Z",
        title: "Algebra template",
        body: "For ratio problems: normalize to 100, set delta variables, and check units before solving.",
        tags: ["QA", "Algebra"],
      },
    ],
    personas: [
      {
        id: "persona-1",
        label: "High-variance sprinter",
        confidence: 78,
        why: [
          "Score jumps when you start with confident sets.",
          "Accuracy dips sharply when a hard set appears early.",
        ],
        signals: ["Attempt-to-attempt variance", "Early section accuracy swings"],
        assumptions: ["Warm-up speed affects decision quality"],
      },
      {
        id: "persona-2",
        label: "Overthinker",
        confidence: 62,
        why: [
          "You re-check correct answers more than once.",
          "Time spent per question is high despite decent accuracy.",
        ],
        signals: ["Review time logs", "Per-question timing"],
        assumptions: ["Confidence dips under time pressure"],
      },
    ],
    strategy: {
      id: "strategy-pace-layering",
      name: "Pace layering",
      summary:
        "Layer your attempt order: secure easy wins early, checkpoint mid, and sprint only after your accuracy bank is safe.",
      bottleneck: "Mid-section time traps are draining your accuracy bank.",
      signalQuality: "Medium",
      confidence: 74,
      assumptions: [
        "Your time split is flexible enough to allow early banking.",
        "You can tolerate skipping one hard set without spiraling.",
      ],
      signals: [
        {
          id: "signal-1",
          source: "attempt",
          label: "Late accuracy dip",
          detail: "Accuracy falls 18 pts after minute 90.",
          weight: 0.9,
        },
        {
          id: "signal-2",
          source: "derived",
          label: "Time sink cluster",
          detail: "38% of time is spent on mid-difficulty sets.",
          weight: 0.82,
        },
        {
          id: "signal-3",
          source: "historical",
          label: "Improved risk profile",
          detail: "Risk score down 12 pts across last 3 mocks.",
          weight: 0.7,
        },
      ],
      confidenceNotes: [
        "Confidence rises when you confirm time splits and mocks/week.",
        "Hypotheses remain around algebra transition speed.",
      ],
    },
    deltas: {
      accuracy: 5,
      speed: 4,
      risk: -6,
      consistency: 9,
    },
    strategyTimeline: [
      {
        id: "timeline-1",
        label: "Selection-first warm start",
        why: "Stabilize early wins to reduce panic decisions.",
        confidenceChange: 6,
        date: "2026-01-09",
      },
      {
        id: "timeline-2",
        label: "Exit rules + error log",
        why: "Close the loop on repeat misses and time sinks.",
        confidenceChange: 8,
        date: "2026-01-16",
      },
      {
        id: "timeline-3",
        label: "Pace layering",
        why: "Bank accuracy first, then sprint with checkpoints.",
        confidenceChange: 10,
        date: "2026-01-21",
      },
    ],
  };
};

const createInitialState = (): CogniverseState => ({
  report: createBaseReport(),
  intake: defaultIntake,
});

type CogniverseContextValue = {
  state: CogniverseState;
  today: PlanDay;
  setIntake: (intake: Partial<IntakeFormState>) => void;
  tuneStrategy: (answers: TuneStrategyAnswers) => void;
  toggleActionComplete: (actionId: string) => void;
  toggleTaskComplete: (dayId: string, taskId: string) => void;
  addNote: (note: Omit<Note, "id" | "createdAt">) => void;
  setCurrentAttempt: (attemptId: string) => void;
};

const CogniverseContext = React.createContext<CogniverseContextValue | null>(null);

const safeParse = (value: string | null): CogniverseState | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as CogniverseState;
  } catch {
    return null;
  }
};

const recomputePlan = (report: Report): Report => {
  const today = deriveTodayPlan(report.plan);

  const plan = report.plan.map((day) => ({
    ...day,
    status: day.id === today.id ? "current" : day.status,
  }));

  return { ...report, plan };
};

export function CogniverseProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CogniverseState>(createInitialState);

  React.useEffect(() => {
    const stored = safeParse(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setState((prev) => ({ ...prev, ...stored, report: recomputePlan(stored.report) }));
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const today = React.useMemo(() => deriveTodayPlan(state.report.plan), [state.report.plan]);

  const setIntake = React.useCallback((intake: Partial<IntakeFormState>) => {
    setState((prev) => ({ ...prev, intake: { ...prev.intake, ...intake } }));
  }, []);

  const tuneStrategy = React.useCallback((answers: TuneStrategyAnswers) => {
    setState((prev) => {
      const confidenceBoost = answers.timeSplitKnown === "yes" ? 4 : 2;
      const updatedActions = prev.report.actions.map((action) =>
        action.id === "action-time-box" ? { ...action, impact: Math.min(99, action.impact + confidenceBoost) } : action,
      );
      const updatedPlan = prev.report.plan.map((day) =>
        day.status === "current"
          ? {
              ...day,
              focus: `${day.focus} · tuned for ${answers.timeSink}`,
            }
          : day,
      );

      const updatedReport: Report = {
        ...prev.report,
        actions: updatedActions,
        plan: updatedPlan,
        strategy: {
          ...prev.report.strategy,
          confidence: Math.min(96, prev.report.strategy.confidence + confidenceBoost),
          confidenceNotes: [
            "Strategy tuned using your latest signals.",
            `Time sink focus: ${answers.timeSink}.`,
          ],
        },
      };

      // TODO: persist StrategyRecommendation tuples keyed by (exam, persona, strategy).
      // TODO: record StrategyOutcome after the next attempt to close the learning loop.

      return {
        ...prev,
        tunedAnswers: answers,
        report: updatedReport,
      };
    });
  }, []);

  const toggleActionComplete = React.useCallback((actionId: string) => {
    setState((prev) => {
      const actions = prev.report.actions.map((action) =>
        action.id === actionId ? { ...action, isCompleted: !action.isCompleted } : action,
      );

      const plan = prev.report.plan.map((day) => ({
        ...day,
        tasks: day.tasks.map((task) =>
          task.actionId === actionId ? { ...task, completed: !task.completed } : task,
        ),
      }));

      // TODO: persist action completion to backend.
      return { ...prev, report: { ...prev.report, actions, plan } };
    });
  }, []);

  const toggleTaskComplete = React.useCallback((dayId: string, taskId: string) => {
    setState((prev) => {
      const plan = prev.report.plan.map((day) =>
        day.id === dayId
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task,
              ),
            }
          : day,
      );

      return { ...prev, report: { ...prev.report, plan } };
    });
  }, []);

  const addNote = React.useCallback((note: Omit<Note, "id" | "createdAt">) => {
    setState((prev) => {
      const newNote: Note = {
        ...note,
        id: nanoid(),
        createdAt: new Date().toISOString(),
      };

      return { ...prev, report: { ...prev.report, notes: [newNote, ...prev.report.notes] } };
    });
  }, []);

  const setCurrentAttempt = React.useCallback((attemptId: string) => {
    setState((prev) => ({ ...prev, report: { ...prev.report, currentAttemptId: attemptId } }));
  }, []);

  const value = React.useMemo<CogniverseContextValue>(
    () => ({
      state,
      today,
      setIntake,
      tuneStrategy,
      toggleActionComplete,
      toggleTaskComplete,
      addNote,
      setCurrentAttempt,
    }),
    [state, today, setIntake, tuneStrategy, toggleActionComplete, toggleTaskComplete, addNote, setCurrentAttempt],
  );

  return <CogniverseContext.Provider value={value}>{children}</CogniverseContext.Provider>;
}

export const useCogniverse = () => {
  const context = React.useContext(CogniverseContext);
  if (!context) {
    throw new Error("useCogniverse must be used within a CogniverseProvider");
  }

  return context;
};
