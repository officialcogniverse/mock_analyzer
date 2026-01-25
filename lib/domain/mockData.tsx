"use client";

import * as React from "react";
import { nanoid } from "nanoid";

import type {
  CogniverseState,
  IntakeFormState,
  LearningSnapshot,
  NextBestAction,
  Note,
  PlanDay,
  PlanTask,
  PlanVariantDays,
  Report,
  TuneStrategyAnswers,
  TrustBreakdown,
} from "./types";
import { deriveTodayPlan } from "./selectors";

const STORAGE_KEY = "cogniverse.mock.state";
const MAX_ACTIONS = 3;
const MAX_TASKS_PER_DAY = 2;
const PLAN_VARIANTS: PlanVariantDays[] = [3, 5, 7];
const FILE_SIZE_LIMIT_BYTES = 8 * 1024 * 1024;

const defaultIntake: IntakeFormState = {
  examLabel: "",
  goal: "Accuracy",
  nextMockDays: "7",
  weeklyHours: "10-20",
  biggestStruggle: "Running out of time",
  dailyCommitmentMinutes: "60",
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
];

type AnalyzeBundle = {
  id?: string;
  attemptId?: string;
  bundle?: {
    attempt?: {
      id: string;
      exam: string;
      created_at: string;
      source_type?: "upload" | "manual" | "text";
      metrics?: Array<{ label: string; value: string }>;
    } | null;
    report?: any;
    profile?: {
      dailyStudyMinutes?: number | null;
      goal?: string | null;
    } | null;
  } | null;
};

type AnalyzeBundleAttempt = NonNullable<AnalyzeBundle["bundle"]>["attempt"];

function clampPlanVariant(value: number): PlanVariantDays {
  if (value <= 3) return 3;
  if (value <= 5) return 5;
  return 7;
}

function normalizePlanVariant(value?: string | number | null): PlanVariantDays {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 7;
  return clampPlanVariant(parsed);
}

function formatUplift(confidence: number) {
  if (confidence >= 80) return "+12–18 marks";
  if (confidence >= 65) return "+8–15 marks";
  if (confidence >= 50) return "+6–10 marks";
  return "+4–8 marks";
}

function computeActionCompletionRate(actions: NextBestAction[]) {
  if (!actions.length) return 0;
  const completed = actions.filter((action) => action.isCompleted).length;
  return Math.round((completed / actions.length) * 100);
}

function buildLearningSnapshot(params: {
  exam: string;
  bottleneck: string;
  strategyName: string;
  actions: NextBestAction[];
}): LearningSnapshot {
  return {
    exam: params.exam,
    primaryBottleneck: params.bottleneck,
    chosenStrategy: params.strategyName,
    actionCompletionRate: computeActionCompletionRate(params.actions),
    nextMockOutcome: null,
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeTrustBreakdown(report: any, lockedReasoning: boolean): TrustBreakdown {
  const metaStrategy = report?.meta?.strategy as
    | {
        confidence_band?: "high" | "medium" | "low";
        assumptions?: string[];
      }
    | undefined;
  const confidenceBand = metaStrategy?.confidence_band || "medium";

  const patternSignals = Array.isArray(report?.patterns)
    ? report.patterns.slice(0, 3).map((pattern: any) => String(pattern?.title || "Pattern signal"))
    : [];

  const actionSignals = Array.isArray(report?.next_actions)
    ? report.next_actions.slice(0, 2).map((action: any) => String(action?.title || "Action signal"))
    : [];

  const signals = [...patternSignals, ...actionSignals].filter(Boolean);
  const assumptions = Array.isArray(metaStrategy?.assumptions)
    ? metaStrategy?.assumptions.map((item) => String(item))
    : ["Timing splits were not provided; plan assumes a balanced time allocation."];

  const reasoning = String(report?.summary || "We focused on the single bottleneck most likely to lift your next mock score.");

  return {
    signals: signals.length ? signals : ["Primary bottleneck inferred from attempt text.", "Action plan aligned to stated goal."],
    assumptions,
    confidenceBand,
    reasoning,
    locked: lockedReasoning,
  };
}

function normalizeAttemptFromBundle(attempt: AnalyzeBundleAttempt, fallbackExam: string) {
  const metrics = attempt?.metrics || [];
  const scoreMetric = metrics.find((metric) => /score/i.test(metric.label));
  const percentileMetric = metrics.find((metric) => /percentile/i.test(metric.label));
  const accuracyMetric = metrics.find((metric) => /accuracy/i.test(metric.label));
  const speedMetric = metrics.find((metric) => /speed|attempt rate/i.test(metric.label));

  const score = scoreMetric ? Number.parseFloat(scoreMetric.value) : 0;
  const accuracy = accuracyMetric ? Number.parseFloat(accuracyMetric.value) : 62;
  const speed = speedMetric ? Number.parseFloat(speedMetric.value) : 58;
  const percentile = percentileMetric ? Number.parseFloat(percentileMetric.value) : undefined;

  return {
    id: attempt?.id || nanoid(),
    examLabel: (attempt?.exam || fallbackExam || "GENERIC").toUpperCase(),
    date: attempt?.created_at || new Date().toISOString(),
    score: Number.isFinite(score) ? score : 0,
    accuracy: Number.isFinite(accuracy) ? accuracy : 62,
    speed: Number.isFinite(speed) ? speed : 58,
    risk: 55,
    consistency: 60,
    timeTakenMinutes: 120,
    percentile: Number.isFinite(percentile || NaN) ? percentile : undefined,
    sections: [
      { name: "Section 1", accuracy: 64, speed: 60, attempts: 20, correct: 13 },
      { name: "Section 2", accuracy: 61, speed: 56, attempts: 18, correct: 11 },
    ],
    notes: "Strategy updated based on your last attempt.",
    source: attempt?.source_type,
  };
}

function normalizeActionsFromReport(
  report: any,
  lockedActionIds: readonly string[]
): NextBestAction[] {
  const incoming = Array.isArray(report?.next_actions) ? report.next_actions : [];

  const mapped = incoming.slice(0, MAX_ACTIONS).map((action: any, index: number) => {
    const id = String(action?.id || `action-${index + 1}`);
    const locked = lockedActionIds.includes(id) || index > 0;
    const steps = Array.isArray(action?.steps)
      ? action.steps.slice(0, 3).map((step: any, stepIndex: number) => ({
          id: String(step?.id || `${id}-step-${stepIndex + 1}`),
          label: String(step?.label || step?.text || "Follow the guided step."),
        }))
      : [
          { id: `${id}-step-1`, label: "Run the drill exactly as written." },
          { id: `${id}-step-2`, label: "Log what changed and what still felt hard." },
        ];

    return {
      id,
      title: String(action?.title || action?.name || "High-leverage action"),
      summary: String(action?.summary || action?.why || "This directly targets your primary bottleneck."),
      durationMinutes: Number(action?.duration_minutes || action?.durationMinutes || 40),
      difficulty: (action?.difficulty as NextBestAction["difficulty"]) || "Focused",
      whyThisHelps: String(action?.why_this_helps || action?.whyThisHelps || "It turns your weakness into points on the next mock."),
      steps,
      tags: Array.isArray(action?.tags) ? action.tags.slice(0, 3).map((tag: any) => String(tag)) : ["Coach", "Execution"],
      relatedPatternIds: Array.isArray(action?.related_pattern_ids)
        ? action.related_pattern_ids.map((patternId: any) => String(patternId))
        : [],
      energy: (action?.energy as NextBestAction["energy"]) || "medium",
      impact: Number(action?.impact || 80 - index * 6),
      isCompleted: Boolean(action?.is_completed || action?.isCompleted),
      locked,
      lockReason: locked ? "Unlock to see the full improvement plan." : undefined,
    } satisfies NextBestAction;
  });

  if (mapped.length) return mapped;

  return [
    {
      id: "action-time-box",
      title: "Run a 6-minute exit rule drill",
      summary: "Practice walking away from mid-difficulty traps without FOMO.",
      durationMinutes: 45,
      difficulty: "Focused",
      whyThisHelps: "It converts wasted time into high-yield attempts and keeps accuracy stable.",
      steps: [
        { id: "step-1", label: "Pick 2 sets you usually overcommit to." },
        { id: "step-2", label: "Set a 6-minute timer and force an exit." },
        { id: "step-3", label: "Re-enter only after finishing your easy bank." },
      ],
      tags: ["Speed", "Selection"],
      relatedPatternIds: [],
      energy: "medium",
      impact: 88,
    },
    {
      id: "action-error-log",
      title: "Build a 12-card error log",
      summary: "Turn misses into tiny flashcards you can revise in 10 minutes.",
      durationMinutes: 35,
      difficulty: "Easy win",
      whyThisHelps: "You fix repeat errors faster when the review loop is short and visual.",
      steps: [
        { id: "step-4", label: "Pick the top 6 misses by frequency." },
        { id: "step-5", label: "Write the trap in one line." },
        { id: "step-6", label: "Add the correct trigger and a check question." },
      ],
      tags: ["Accuracy", "Revision"],
      relatedPatternIds: [],
      energy: "low",
      impact: 82,
      locked: true,
      lockReason: "Unlock to access the rest of your plan.",
    },
    {
      id: "action-pressure-reps",
      title: "25-minute pressure reps",
      summary: "Simulate mock stress with strict time and zero pauses.",
      durationMinutes: 25,
      difficulty: "Deep work",
      whyThisHelps: "Stress-proof reps reduce late-section accuracy dips and improve decision speed.",
      steps: [
        { id: "step-7", label: "Choose one mixed set of 12 questions." },
        { id: "step-8", label: "Start the timer and ban solution peeking." },
        { id: "step-9", label: "Review only after time ends; log every guess." },
      ],
      tags: ["Stress", "Decision"],
      relatedPatternIds: [],
      energy: "high",
      impact: 91,
      locked: true,
      lockReason: "Unlock to access the rest of your plan.",
    },
  ];
}

function buildFallbackPlan(planVariant: PlanVariantDays, actions: NextBestAction[]): PlanDay[] {
  const todayIso = new Date().toISOString();

  return Array.from({ length: planVariant }).map((_, index) => {
    const action = actions[index % actions.length];
    const locked = index > 0;

    return {
      id: `plan-day-${index + 1}`,
      dayIndex: index + 1,
      label: `Day ${index + 1}`,
      date: todayIso,
      focus: index === 0 ? "Close the fastest loop" : "Reinforce and rehearse",
      status: index === 0 ? "current" : "upcoming",
      energyHint: index === 0 ? "medium" : "high",
      locked,
      tasks: [
        {
          id: `task-${index + 1}-1`,
          actionId: action?.id,
          title: action?.title || "Complete your coach action",
          durationMinutes: action?.durationMinutes || 40,
          type: "drill",
          why: action?.whyThisHelps || "It directly increases your next mock score.",
          tags: action?.tags || ["Coach"],
          locked,
        },
      ],
    } satisfies PlanDay;
  });
}

function normalizePlanFromReport(report: any, params: { planVariant: PlanVariantDays; paywallLockedPlan: boolean; actions: NextBestAction[] }) {
  const incomingDays = Array.isArray(report?.plan?.days) ? report.plan.days : [];

  if (!incomingDays.length) {
    return buildFallbackPlan(params.planVariant, params.actions);
  }

  const trimmed = incomingDays.slice(0, params.planVariant);

  return trimmed.map((day: any, index: number) => {
    const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
    const locked = params.paywallLockedPlan && index > 0;

    const mappedTasks = tasks.slice(0, MAX_TASKS_PER_DAY).map((task: any, taskIndex: number) => {
      const taskId = String(task?.id || `task-${index + 1}-${taskIndex + 1}`);
      const actionMatch = params.actions.find((action) => action.title === task?.title);

      return {
        id: taskId,
        actionId: actionMatch?.id,
        title: String(task?.title || "Coach task"),
        durationMinutes: Number(task?.duration_minutes || task?.durationMinutes || 35),
        type: (task?.type as PlanTask["type"]) || "drill",
        why: String(task?.why || "This is the shortest path to points on your next mock."),
        tags: Array.isArray(task?.tags) ? task.tags.map((tag: any) => String(tag)) : ["Coach"],
        completed: Boolean(task?.completed),
        locked,
      } satisfies PlanTask;
    });

    return {
      id: String(day?.id || `plan-day-${index + 1}`),
      dayIndex: index + 1,
      label: `Day ${index + 1}`,
      date: String(day?.date || new Date().toISOString()),
      focus: String(day?.focus || day?.goal || "Focus on the bottleneck"),
      milestone: day?.milestone ? String(day.milestone) : undefined,
      status: index === 0 ? "current" : "upcoming",
      energyHint: index === 0 ? "medium" : "high",
      tasks: mappedTasks.length ? mappedTasks : buildFallbackPlan(params.planVariant, params.actions)[index].tasks,
      locked,
    } satisfies PlanDay;
  });
}

function applyPlanLocks(plan: PlanDay[], paywallLockedPlan: boolean) {
  return plan.map((day, index) => {
    const locked = paywallLockedPlan && index > 0;
    return {
      ...day,
      locked,
      tasks: day.tasks.map((task) => ({ ...task, locked })),
    } satisfies PlanDay;
  });
}

function recomputePlan(report: Report): Report {
  const today = deriveTodayPlan(report.plan);

  const plan: PlanDay[] = report.plan.map((day) => ({
    ...day,
    status: (day.id === today.id
      ? "current"
      : day.status === "current"
      ? "upcoming"
      : day.status) as PlanDay["status"],
  }));

  return { ...report, plan };
}

function createBaseReport(): Report {
  const generatedAt = new Date().toISOString();
  const paywall = {
    isPremium: false,
    lockedActionIds: ["action-error-log", "action-pressure-reps"],
    lockedPlan: true,
    lockedReasoning: true,
    lockedProgress: true,
    ctaLabel: "Unlock your full improvement plan",
    ctaHint: "Get every action, full reasoning, and progress tracking before your next mock.",
  } as const;

  const actions = normalizeActionsFromReport(null, paywall.lockedActionIds).map((action, index) => ({
    ...action,
    locked: index > 0,
    lockReason: index > 0 ? "Unlock to see the full plan." : undefined,
  }));

  const planVariant: PlanVariantDays = 7;
  const plan = applyPlanLocks(
    [
      {
        id: "plan-day-1",
        dayIndex: 1,
        label: "Day 1",
        date: "2026-01-19",
        focus: "Stop mid-section time leaks",
        milestone: "Accuracy bank protected",
        status: "current",
        energyHint: "medium",
        tasks: basePlanTasks.slice(0, 2).map((task, index) => ({
          ...task,
          id: `${task.id}-d1-${index}`,
          completed: index === 1,
        })),
      },
      {
        id: "plan-day-2",
        dayIndex: 2,
        label: "Day 2",
        date: "2026-01-20",
        focus: "Rehearse exits under pressure",
        status: "upcoming",
        energyHint: "high",
        tasks: [
          {
            id: "task-d2-1",
            actionId: "action-time-box",
            title: "6-minute exit drill (2 reps)",
            durationMinutes: 40,
            type: "drill",
            why: "Builds the muscle to leave traps early.",
            tags: ["Speed", "Selection"],
          },
          {
            id: "task-d2-2",
            actionId: "action-error-log",
            title: "Error log refresh (top 8 misses)",
            durationMinutes: 30,
            type: "review",
            why: "Turns misses into reusable triggers.",
            tags: ["Accuracy"],
          },
        ],
      },
      {
        id: "plan-day-3",
        dayIndex: 3,
        label: "Day 3",
        date: "2026-01-21",
        focus: "Pressure reps without pausing",
        status: "upcoming",
        energyHint: "high",
        tasks: [
          {
            id: "task-d3-1",
            actionId: "action-pressure-reps",
            title: "25-minute pressure rep",
            durationMinutes: 25,
            type: "drill",
            why: "Stress-proof your decision speed.",
            tags: ["Stress", "Decision"],
          },
        ],
      },
      {
        id: "plan-day-4",
        dayIndex: 4,
        label: "Day 4",
        date: "2026-01-22",
        focus: "Light review + confidence build",
        status: "upcoming",
        energyHint: "low",
        tasks: [
          {
            id: "task-d4-1",
            title: "Review the error log out loud",
            durationMinutes: 20,
            type: "review",
            why: "Locks in triggers before the next mock.",
            tags: ["Recall"],
          },
        ],
      },
      {
        id: "plan-day-5",
        dayIndex: 5,
        label: "Day 5",
        date: "2026-01-23",
        focus: "Mini mock with exit rules",
        milestone: "Mock rehearsal complete",
        status: "upcoming",
        energyHint: "high",
        tasks: [
          {
            id: "task-d5-1",
            title: "75-minute mini mock",
            durationMinutes: 75,
            type: "mock",
            why: "Rehearses timing splits before the full mock.",
            tags: ["Mock", "Timing"],
          },
          {
            id: "task-d5-2",
            title: "Rapid review + action notes",
            durationMinutes: 30,
            type: "review",
            why: "Converts the rehearsal into next actions quickly.",
            tags: ["Review"],
          },
        ],
      },
      {
        id: "plan-day-6",
        dayIndex: 6,
        label: "Day 6",
        date: "2026-01-24",
        focus: "Confidence reps + recovery",
        status: "upcoming",
        energyHint: "medium",
        tasks: [
          {
            id: "task-d6-1",
            title: "2 confident sets with strict exits",
            durationMinutes: 35,
            type: "drill",
            why: "Builds momentum without fatigue.",
            tags: ["Confidence"],
          },
        ],
      },
      {
        id: "plan-day-7",
        dayIndex: 7,
        label: "Day 7",
        date: "2026-01-25",
        focus: "Mock day script",
        milestone: "Next mock ready",
        status: "upcoming",
        energyHint: "low",
        tasks: [
          {
            id: "task-d7-1",
            title: "Run the mock day checklist",
            durationMinutes: 15,
            type: "recovery",
            why: "Keeps you calm and consistent when it counts.",
            tags: ["Checklist"],
          },
        ],
      },
    ],
    paywall.lockedPlan,
  );

  const strategyName = "Pace layering";
  const confidence = 76;

  return {
    id: "report-cat-001",
    generatedAt,
    goal: "Accuracy",
    streakDays: 3,
    weeklyCompletion: [
      { day: "Mon", completed: 2 },
      { day: "Tue", completed: 1 },
      { day: "Wed", completed: 3 },
      { day: "Thu", completed: 0 },
      { day: "Fri", completed: 0 },
      { day: "Sat", completed: 0 },
      { day: "Sun", completed: 0 },
    ],
    confidenceHistory: [
      { label: "Mock 1", confidence: 58 },
      { label: "Mock 2", confidence: 66 },
      { label: "Mock 3", confidence: confidence },
    ],
    attempts: [
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
        ],
        notes: "Time-boxing helped; still slow in QA algebra cluster.",
        source: "upload",
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
    ],
    actions,
    plan,
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
    ],
    personas: [],
    strategy: {
      id: "strategy-pace-layering",
      name: strategyName,
      summary:
        "Layer your attempt order: secure easy wins early, checkpoint mid, and sprint only after your accuracy bank is safe.",
      bottleneck: "Mid-section time traps are draining your accuracy bank.",
      signalQuality: "Medium",
      confidence,
      assumptions: [
        "Daily study time is ~60 minutes.",
        "Next mock is within a week.",
      ],
      signals: [
        {
          id: "signal-1",
          source: "attempt",
          label: "Late accuracy dip",
          detail: "Accuracy falls 18 pts after minute 90.",
          weight: 0.9,
        },
      ],
      confidenceNotes: ["Strategy updated based on your last attempt."],
    },
    deltas: {
      accuracy: 5,
      speed: 4,
      risk: -6,
      consistency: 9,
    },
    strategyTimeline: [],
    hero: {
      primaryBottleneck: "Mid-section time traps are costing you easy marks.",
      upliftRange: formatUplift(confidence),
      dailyCommitmentMinutes: 60,
    },
    trust: {
      signals: [
        "Late-section accuracy dip after minute 90.",
        "Time spent is concentrated on mid-difficulty sets.",
      ],
      assumptions: [
        "Daily study time is ~60 minutes.",
        "Plan assumes one mock in the next 7 days.",
      ],
      confidenceBand: "medium",
      reasoning: "We are prioritizing exit rules because they protect accuracy while freeing time for easy marks.",
      locked: true,
    },
    paywall,
    learning: buildLearningSnapshot({
      exam: "CAT",
      bottleneck: "Mid-section time traps",
      strategyName,
      actions,
    }),
    planVariant,
    availablePlanVariants: PLAN_VARIANTS,
  };
}

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
  setPlanVariant: (variant: PlanVariantDays) => void;
  analyzeAttempt: (params: {
    examLabel?: string;
    files: File[];
    manualText?: string;
  }) => Promise<{ attemptId: string }>;
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

function toGoal(goal: IntakeFormState["goal"]) {
  switch (goal) {
    case "Score":
      return "score" as const;
    case "Speed":
      return "speed" as const;
    case "Concepts":
      return "concepts" as const;
    case "Accuracy":
    default:
      return "accuracy" as const;
  }
}

function toHardest(struggle: string) {
  const normalized = struggle.toLowerCase();
  if (normalized.includes("time")) return "time" as const;
  if (normalized.includes("careless")) return "careless" as const;
  if (normalized.includes("concept")) return "concepts" as const;
  if (normalized.includes("selection")) return "selection" as const;
  if (normalized.includes("stress") || normalized.includes("anxiety")) return "anxiety" as const;
  return "consistency" as const;
}

function buildIntakePayload(intake: IntakeFormState) {
  return {
    goal: toGoal(intake.goal),
    hardest: toHardest(intake.biggestStruggle),
    weekly_hours: intake.weeklyHours || "10-20",
    next_mock_days: intake.nextMockDays || "7",
    daily_minutes: intake.dailyCommitmentMinutes || "60",
  };
}

function derivePlanVariantFromReport(report: any, fallback: PlanVariantDays) {
  const planDays = Array.isArray(report?.plan?.days) ? report.plan.days.length : fallback;
  return clampPlanVariant(planDays);
}

function deriveLockedActionIds(actions: NextBestAction[]) {
  return actions.filter((action, index) => index > 0 || action.locked).map((action) => action.id);
}

function normalizeReportFromBundle(params: {
  bundle: NonNullable<AnalyzeBundle["bundle"]>;
  fallbackReport: Report;
  intake: IntakeFormState;
}): Report {
  const bundleReport = params.bundle.report || {};
  const fallback = params.fallbackReport;
  const planVariant = derivePlanVariantFromReport(bundleReport, normalizePlanVariant(params.intake.nextMockDays));

  const paywall = {
    ...fallback.paywall,
    lockedPlan: true,
    lockedReasoning: true,
    lockedProgress: true,
  };

  const actions = normalizeActionsFromReport(bundleReport, paywall.lockedActionIds);
  const lockedActionIds = deriveLockedActionIds(actions);
  const paywallWithLocks = { ...paywall, lockedActionIds };

  const confidence = Number(bundleReport?.confidence || fallback.strategy.confidence || 68);
  const primaryBottleneck = String(bundleReport?.primary_bottleneck || fallback.hero.primaryBottleneck);
  const dailyCommitmentMinutes = Number(params.bundle.profile?.dailyStudyMinutes || params.intake.dailyCommitmentMinutes || fallback.hero.dailyCommitmentMinutes);

  const planRaw = normalizePlanFromReport(bundleReport, {
    planVariant,
    paywallLockedPlan: paywallWithLocks.lockedPlan,
    actions,
  });
  const plan = applyPlanLocks(planRaw, paywallWithLocks.lockedPlan);

  const trust = normalizeTrustBreakdown(bundleReport, paywallWithLocks.lockedReasoning);

  const attempt = normalizeAttemptFromBundle(params.bundle.attempt || null, params.intake.examLabel || "GENERIC");
  const attempts = [...fallback.attempts.filter((item) => item.id !== attempt.id), attempt];

  const strategyName = String(bundleReport?.next_mock_strategy?.name || fallback.strategy.name);
  const updatedLearning = buildLearningSnapshot({
    exam: attempt.examLabel || "GENERIC",
    bottleneck: primaryBottleneck,
    strategyName,
    actions,
  });

  const updatedReport: Report = {
    ...fallback,
    id: String(bundleReport?.report_id || fallback.id),
    generatedAt: fallback.generatedAt,
    goal: params.intake.goal,
    attempts,
    currentAttemptId: attempt.id,
    actions,
    plan,
    hero: {
      primaryBottleneck,
      upliftRange: formatUplift(confidence),
      dailyCommitmentMinutes: Number.isFinite(dailyCommitmentMinutes) ? dailyCommitmentMinutes : fallback.hero.dailyCommitmentMinutes,
    },
    trust,
    paywall: paywallWithLocks,
    learning: updatedLearning,
    planVariant,
    availablePlanVariants: PLAN_VARIANTS,
    strategy: {
      ...fallback.strategy,
      name: strategyName,
      summary: String(bundleReport?.summary || fallback.strategy.summary),
      bottleneck: primaryBottleneck,
      signalQuality: (String(bundleReport?.signal_quality || fallback.strategy.signalQuality).replace(/^./, (c) => c.toUpperCase()) as Report["strategy"]["signalQuality"]),
      confidence,
      assumptions: trust.assumptions,
      confidenceNotes: [
        "Your strategy updated based on your last attempt.",
        `Confidence band: ${trust.confidenceBand}.`,
      ],
    },
  };

  return recomputePlan(updatedReport);
}

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

  const setPlanVariant = React.useCallback((variant: PlanVariantDays) => {
    setState((prev) => {
      const slicedPlan = prev.report.plan.slice(0, variant);
      const planWithLocks = applyPlanLocks(slicedPlan, prev.report.paywall.lockedPlan);

      return {
        ...prev,
        intake: { ...prev.intake, nextMockDays: String(variant) },
        report: recomputePlan({
          ...prev.report,
          planVariant: variant,
          plan: planWithLocks,
        }),
      };
    });
  }, []);

  const analyzeAttempt = React.useCallback(
    async (params: { examLabel?: string; files: File[]; manualText?: string }) => {
      if (!params.files.length) {
        throw new Error("Upload a PDF to generate your plan.");
      }

      params.files.forEach((file) => {
        if (file.type !== "application/pdf") {
          throw new Error("Only PDF scorecards are supported right now.");
        }
        if (file.size > FILE_SIZE_LIMIT_BYTES) {
          throw new Error("PDF is too large. Please upload a file under 8MB.");
        }
      });

      const form = new FormData();
      const examLabel = params.examLabel || state.intake.examLabel || "GENERIC";
      form.set("exam", examLabel);
      form.set("intake", JSON.stringify(buildIntakePayload(state.intake)));
      if (params.manualText?.trim()) {
        form.set("manual", JSON.stringify({ notes: params.manualText.trim() }));
      }
      params.files.forEach((file) => form.append("files", file));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });

      const data = (await response.json()) as AnalyzeBundle;
      if (!response.ok) {
        const errorMessage = String((data as any)?.error || "Upload failed. Please try again.");
        throw new Error(errorMessage);
      }

      if (!data.bundle?.attempt?.id) {
        throw new Error("We could not read that PDF. Try exporting it again and upload the new file.");
      }

      const attemptId = data.bundle.attempt.id;

      setState((prev) => {
        const normalized = normalizeReportFromBundle({
          bundle: data.bundle as NonNullable<AnalyzeBundle["bundle"]>,
          fallbackReport: prev.report,
          intake: {
            ...prev.intake,
            examLabel,
          },
        });

        // TODO(v2): persist plan variant, action completion, and reflections to backend.
        // TODO(v2): capture next mock outcome and feed it into learning updates.

        return {
          ...prev,
          intake: {
            ...prev.intake,
            examLabel,
            nextMockDays: String(normalized.planVariant),
            dailyCommitmentMinutes: String(normalized.hero.dailyCommitmentMinutes),
          },
          report: normalized,
        };
      });

      return { attemptId };
    },
    [state.intake],
  );

  const tuneStrategy = React.useCallback((answers: TuneStrategyAnswers) => {
    setState((prev) => {
      const confidenceBoost = answers.timeSplitKnown === "yes" ? 4 : 2;
      const updatedActions = prev.report.actions.map((action, index) =>
        index === 0 ? { ...action, impact: Math.min(99, action.impact + confidenceBoost) } : action,
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
        learning: {
          ...prev.report.learning,
          actionCompletionRate: computeActionCompletionRate(updatedActions),
          lastUpdated: new Date().toISOString(),
        },
      };

      return {
        ...prev,
        tunedAnswers: answers,
        report: recomputePlan(updatedReport),
      };
    });
  }, []);

  const toggleActionComplete = React.useCallback((actionId: string) => {
    setState((prev) => {
      const actions = prev.report.actions.map((action) => {
        if (action.id !== actionId || action.locked) return action;
        return { ...action, isCompleted: !action.isCompleted };
      });

      const plan = prev.report.plan.map((day) => ({
        ...day,
        tasks: day.tasks.map((task) =>
          task.actionId === actionId && !task.locked ? { ...task, completed: !task.completed } : task,
        ),
      }));

      return {
        ...prev,
        report: recomputePlan({
          ...prev.report,
          actions,
          plan,
          learning: {
            ...prev.report.learning,
            actionCompletionRate: computeActionCompletionRate(actions),
            lastUpdated: new Date().toISOString(),
          },
        }),
      };
    });
  }, []);

  const toggleTaskComplete = React.useCallback((dayId: string, taskId: string) => {
    setState((prev) => {
      const plan = prev.report.plan.map((day) =>
        day.id === dayId && !day.locked
          ? {
              ...day,
              tasks: day.tasks.map((task) =>
                task.id === taskId && !task.locked ? { ...task, completed: !task.completed } : task,
              ),
            }
          : day,
      );

      return { ...prev, report: recomputePlan({ ...prev.report, plan }) };
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
      setPlanVariant,
      analyzeAttempt,
    }),
    [
      state,
      today,
      setIntake,
      tuneStrategy,
      toggleActionComplete,
      toggleTaskComplete,
      addNote,
      setCurrentAttempt,
      setPlanVariant,
      analyzeAttempt,
    ],
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
