import { nanoid } from "nanoid";
import { z } from "zod";
import { ReportSchema, type Report } from "@/lib/domain/schemas";
import type { AttemptHistorySignal, ProfileSignals } from "@/lib/types";

const DEV_LOG = process.env.NODE_ENV !== "production";

const bandEnum = z.enum(["low", "medium", "high"]);

type NormalizeContext = {
  userId: string;
  attemptId?: string;
  reportId?: string;
  createdAt?: string;
  planDays?: number;
  profile?: ProfileSignals | null;
  history?: AttemptHistorySignal[];
};

type LegacyPattern = {
  title?: string;
  evidence?: string;
  impact?: string;
  fix?: string;
  severity?: number;
};

type LegacyAction = {
  title?: string;
  why?: string;
  duration?: string;
  duration_min?: number;
  expected_impact?: string;
  difficulty?: number;
  steps?: string[];
  success_metric?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toIsoString(value: string | Date | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function slugify(value: string, fallback: string) {
  const base = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return (base || fallback).slice(0, 64);
}

function parseDurationToMinutes(value: unknown, fallback: number) {
  if (Number.isFinite(Number(value))) return clamp(Number(value), 5, 240);
  const text = String(value || "").toLowerCase();
  const match = text.match(/(\d{1,3})/);
  if (match) return clamp(Number(match[1]), 5, 240);
  return fallback;
}

function normalizeBand(value: unknown, fallback: "low" | "medium" | "high" = "medium") {
  const parsed = bandEnum.safeParse(String(value || "").toLowerCase());
  return parsed.success ? parsed.data : fallback;
}

function computeSignalQualityBand(raw: any) {
  const explicit = raw?.signal_quality || raw?.signalQuality || raw?.meta?.signal_quality;
  if (typeof explicit === "string") return normalizeBand(explicit);
  if (explicit && typeof explicit === "object") {
    return normalizeBand(explicit.band ?? explicit.level ?? explicit.value);
  }

  const missingSignals = Array.isArray(raw?.meta?.strategy?.missing_signals)
    ? raw.meta.strategy.missing_signals.length
    : 0;
  if (missingSignals >= 4) return "low";
  if (missingSignals >= 2) return "medium";
  return "high";
}

function computeConfidence(raw: any, signalQuality: "low" | "medium" | "high") {
  const explicit = raw?.confidence ?? raw?.meta?.strategy?.confidence_score ?? raw?.meta?.strategy_plan?.confidence?.score;
  if (Number.isFinite(Number(explicit))) return clamp(Number(explicit), 0, 100);
  if (signalQuality === "low") return 46;
  if (signalQuality === "high") return 78;
  return 64;
}

function derivePrimaryBottleneck(raw: any, profile?: ProfileSignals | null) {
  const candidates = [
    raw?.primary_bottleneck,
    raw?.primaryBottleneck,
    raw?.meta?.primary_bottleneck,
    raw?.patterns?.[0]?.title,
    profile?.biggestStruggle,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text) return text;
  }

  return "Execution stability under time pressure";
}

function deriveHistoryNote(history?: AttemptHistorySignal[]) {
  if (!history || history.length < 2) return null;
  const last = history[0];
  const prev = history[1];
  if (!last || !prev) return null;
  const lastAcc = last.accuracy_pct;
  const prevAcc = prev.accuracy_pct;
  if (Number.isFinite(Number(lastAcc)) && Number.isFinite(Number(prevAcc))) {
    const delta = Number(lastAcc) - Number(prevAcc);
    if (Math.abs(delta) >= 2) {
      const dir = delta > 0 ? "up" : "down";
      return `Accuracy trend is ${dir} by ${Math.abs(Math.round(delta))} pts vs the previous mock.`;
    }
  }
  return null;
}

function actionTemplate(params: {
  title: string;
  why: string;
  duration_min: number;
  difficulty: number;
  steps: string[];
  success_metric: string;
}) {
  return params;
}

export function deriveFallbackActions(primaryBottleneck: string, goal: ProfileSignals["goal"]) {
  const bottleneck = primaryBottleneck.toLowerCase();
  const goalLabel = goal || "score";

  if (bottleneck.includes("time") || bottleneck.includes("pace")) {
    return [
      actionTemplate({
        title: "Run a 2-pass pacing drill",
        why: "Protects marks by securing easy-medium questions before time leaks.",
        duration_min: 30,
        difficulty: 3,
        steps: [
          "Set a 30-minute timer for one section.",
          "Pass 1: attempt only questions that look solvable in under 90 seconds.",
          "Pass 2: return to flagged questions with remaining time.",
        ],
        success_metric: "Pass-1 attempts completed within 65% of section time.",
      }),
      actionTemplate({
        title: "Install hard time checkpoints",
        why: "Time checkpoints prevent late-section panic and random guessing.",
        duration_min: 15,
        difficulty: 2,
        steps: [
          "Write 2-3 timestamps you must hit during the section.",
          "At each checkpoint, decide: continue, skip, or change section.",
          "Abort any question that breaks the checkpoint plan.",
        ],
        success_metric: "All checkpoints hit within ±2 minutes.",
      }),
      actionTemplate({
        title: "Practice deliberate skipping",
        why: "Skipping faster is often the highest ROI decision for time bottlenecks.",
        duration_min: 20,
        difficulty: 2,
        steps: [
          "Do a 12-question set with a 75-second cap per question.",
          "Skip immediately after the cap without forcing progress.",
          "Review whether the skips were correct decisions.",
        ],
        success_metric: "At least 80% of skips are confirmed as good decisions on review.",
      }),
    ];
  }

  if (bottleneck.includes("careless") || bottleneck.includes("silly")) {
    return [
      actionTemplate({
        title: "Add a 20-second verification rule",
        why: "A lightweight check catches sign/unit/constraint errors without killing speed.",
        duration_min: 15,
        difficulty: 2,
        steps: [
          "Before submitting, check sign, units, and one key constraint.",
          "Mark the single value you will verify before solving.",
          "Track misses that verification would have caught.",
        ],
        success_metric: "Careless errors drop in the next mock review log.",
      }),
      actionTemplate({
        title: "Run a calm accuracy block",
        why: "Slowing slightly during practice builds cleaner setups and better decision quality.",
        duration_min: 25,
        difficulty: 3,
        steps: [
          "Pick 10-14 medium questions from one topic.",
          "Prioritize clean setup over speed.",
          "Write the exact cause of every miss.",
        ],
        success_metric: "Accuracy ≥ 80% with clear error causes documented.",
      }),
      actionTemplate({
        title: "Create a 3-line error checklist",
        why: "Short checklists reduce repeated mistakes under pressure.",
        duration_min: 10,
        difficulty: 1,
        steps: [
          "List your top 3 recurring error types.",
          "Turn each into a single if-then rule.",
          "Read the checklist before every timed set.",
        ],
        success_metric: "Checklist is referenced before the next timed session.",
      }),
    ];
  }

  if (bottleneck.includes("concept") || bottleneck.includes("fundamental")) {
    return [
      actionTemplate({
        title: "Run a concept rebuild sprint",
        why: "Rebuilds just enough theory to unblock execution in the next mock.",
        duration_min: 35,
        difficulty: 4,
        steps: [
          "Choose one weak topic you saw in the mock.",
          "Review the core idea plus 2 canonical examples.",
          "Immediately solve 6 targeted problems.",
        ],
        success_metric: "You can solve 4/6 targeted problems without hints.",
      }),
      actionTemplate({
        title: "Make a trigger-based formula sheet",
        why: "Formulas become usable when tied to triggers, not just memorized.",
        duration_min: 20,
        difficulty: 2,
        steps: [
          "Write only formulas used in recent mistakes.",
          "Add a trigger cue for each formula.",
          "Review the sheet before your next timed set.",
        ],
        success_metric: "Sheet is used in at least one timed drill session.",
      }),
      actionTemplate({
        title: "Do a teach-back drill",
        why: "Explaining reveals gaps faster than passive review.",
        duration_min: 15,
        difficulty: 3,
        steps: [
          "Explain one tough question out loud step-by-step.",
          "Highlight where the decision should have changed.",
          "Write the 2 cues you missed initially.",
        ],
        success_metric: "You can restate the decision cues without looking at notes.",
      }),
    ];
  }

  const goalNudge =
    goalLabel === "speed"
      ? "while keeping speed gains real"
      : goalLabel === "accuracy"
      ? "while protecting accuracy"
      : goalLabel === "concepts"
      ? "while reinforcing concepts that block execution"
      : "with the fastest path to score lift";

  return [
    actionTemplate({
      title: "Run a focused decision sprint",
      why: `Improves attempt/skip decisions ${goalNudge}.`,
      duration_min: 25,
      difficulty: 3,
      steps: [
        "Pick 15 questions from one section.",
        "Spend 20 seconds deciding attempt vs skip before solving.",
        "Review only decision mistakes first, then content mistakes.",
      ],
      success_metric: "Decision mistakes are explicitly logged and reduced in the next set.",
    }),
    actionTemplate({
      title: "Create a next-mock rules card",
      why: "A short rules card reduces drift when stress rises mid-exam.",
      duration_min: 15,
      difficulty: 2,
      steps: [
        "Write 3 rules: one pacing, one accuracy, one skip rule.",
        "Keep the card visible during practice.",
        "Review it immediately before the next mock.",
      ],
      success_metric: "All 3 rules are followed during the next timed set.",
    }),
    actionTemplate({
      title: "Close the loop with a 10-minute review",
      why: "Quick reviews convert insights into behavior change faster than long retrospectives.",
      duration_min: 10,
      difficulty: 1,
      steps: [
        "After each session, log the top 2 mistakes and the rule to prevent them.",
        "Tag each mistake as decision, knowledge, or pressure.",
        "Use the tags to choose the next drill.",
      ],
      success_metric: "At least 2 mistakes are logged with prevention rules after the next session.",
    }),
  ];
}

function normalizePatterns(raw: any, primaryBottleneck: string) {
  const legacyPatterns: LegacyPattern[] = Array.isArray(raw?.patterns)
    ? raw.patterns
    : Array.isArray(raw?.pattern_cards)
    ? raw.pattern_cards
    : [];

  const fallback: LegacyPattern[] = legacyPatterns.length
    ? legacyPatterns
    : [
        {
          title: primaryBottleneck,
          evidence: "Scorecard signals were limited, so we prioritized the most common execution leak.",
          impact: "Uncontrolled decision-making can erase easy marks even when concepts are known.",
          fix: "Install strict attempt/skip rules and validate them with probes.",
          severity: 3,
        },
      ];

  return fallback.slice(0, 6).map((pattern, idx) => ({
    id: slugify(pattern.title || `pattern-${idx + 1}`, `pattern-${idx + 1}`),
    title: String(pattern.title || `Pattern ${idx + 1}`),
    evidence: String(pattern.evidence || "Evidence not provided."),
    impact: String(pattern.impact || "Impact unknown."),
    fix: String(pattern.fix || "No fix provided."),
    severity: clamp(Number(pattern.severity || 3), 1, 5),
  }));
}

function normalizeActions(raw: any, primaryBottleneck: string, profile?: ProfileSignals | null) {
  const fromRaw: LegacyAction[] = Array.isArray(raw?.next_actions)
    ? raw.next_actions
    : Array.isArray(raw?.nextActions)
    ? raw.nextActions
    : Array.isArray(raw?.actions)
    ? raw.actions
    : [];

  const fallback = fromRaw.length
    ? fromRaw
    : deriveFallbackActions(primaryBottleneck, profile?.goal);

  return fallback.slice(0, 3).map((action, idx) => {
    const actionAny = action as any;
    const title = String(actionAny.title || `Next action ${idx + 1}`);
    const id = slugify(title, `action-${idx + 1}`);
    const why = String(
      actionAny.why || actionAny.expected_impact || "This action targets your primary bottleneck."
    );
    const duration = parseDurationToMinutes(actionAny.duration_min ?? actionAny.duration, 25 + idx * 5);
    const difficulty = clamp(Number(actionAny.difficulty || 3), 1, 5);
    const steps = Array.isArray(actionAny.steps) ? actionAny.steps.map(String).slice(0, 6) : [];
    const successMetric = String(
      actionAny.success_metric ||
        actionAny.expected_impact ||
        "You can execute this rule in the next mock without hesitation."
    );

    return {
      id,
      title,
      why,
      duration_min: duration,
      difficulty,
      steps: steps.length ? steps : ["Execute the rule once in a timed drill before the next mock."],
      success_metric: successMetric,
    };
  });
}

function normalizePlanDays(params: {
  raw: any;
  planDays: number;
  actions: Report["next_actions"];
  profile?: ProfileSignals | null;
}) {
  const { raw, planDays, actions, profile } = params;
  const fromPlan = raw?.plan?.days;
  const fromDayWise = raw?.day_wise_plan;
  const fromStrategyPlan = raw?.meta?.strategy_plan?.plan_days;

  const legacyDays = Array.isArray(fromPlan)
    ? fromPlan
    : Array.isArray(fromDayWise)
    ? fromDayWise
    : Array.isArray(fromStrategyPlan)
    ? fromStrategyPlan
    : [];

  const minutesPerDay = clamp(Number(profile?.dailyStudyMinutes || 60), 30, 240);

  const actionById = new Map(actions.map((action) => [action.id, action]));

  function ensureTasks(dayIndex: number) {
    const primaryAction = actions[(dayIndex - 1) % actions.length] || actions[0];
    const secondaryAction = actions[(dayIndex + 1) % actions.length] || primaryAction;

    const tasks: Array<{ action_id?: string; title: string; duration_min: number; note?: string }> = [primaryAction, secondaryAction]
      .filter(Boolean)
      .slice(0, 2)
      .map((action, idx) => ({
        action_id: action.id,
        title: idx === 0 ? action.title : `${action.title} (light)` ,
        duration_min: clamp(Math.round(action.duration_min * (idx === 0 ? 1 : 0.6)), 10, 90),
        note:
          idx === 0
            ? "Execute with full focus and log the result."
            : "Quick reinforcement to keep the rule sticky.",
      }));

    const remaining = Math.max(0, minutesPerDay - tasks.reduce((sum, task) => sum + task.duration_min, 0));
    if (remaining >= 15) {
      tasks.push({
        action_id: undefined,
        title: "10-minute review + error log",
        duration_min: clamp(Math.min(remaining, 20), 10, 25),
        note: "Write the single rule that would have saved the most marks today.",
      });
    }

    return tasks;
  }

  const normalizedLegacy = legacyDays
    .map((day: any, idx: number) => {
      const dayIndex = Number(day?.day_index ?? day?.day ?? idx + 1);
      const validIndex = Number.isFinite(dayIndex) ? clamp(dayIndex, 1, planDays) : idx + 1;
      const label = String(day?.label || day?.title || `Day ${validIndex}`);
      const focus = String(day?.focus || day?.theme || `Sharpen ${actions[0]?.title || "execution"}`);
      const tasksRaw = Array.isArray(day?.tasks) ? day.tasks : Array.isArray(day?.actions) ? day.actions : [];

      const tasks = tasksRaw
        .map((task: any, taskIdx: number) => {
          if (typeof task === "string") {
            return {
              title: task,
              duration_min: clamp(Math.round(minutesPerDay / 3), 10, 60),
            };
          }
          const taskTitle = String(task?.title || task?.name || `Task ${taskIdx + 1}`);
          const actionId = task?.action_id ? String(task.action_id) : undefined;
          const linkedAction = actionId ? actionById.get(actionId) : undefined;
          return {
            action_id: linkedAction?.id ?? actionId,
            title: taskTitle,
            duration_min: parseDurationToMinutes(task?.duration_min ?? task?.minutes, clamp(Math.round(minutesPerDay / 3), 10, 70)),
            note: task?.note ? String(task.note) : undefined,
          };
        })
        .filter((task: any) => task.title);

      return {
        day_index: validIndex,
        label,
        focus,
        tasks: tasks.length ? tasks : ensureTasks(validIndex),
      };
    })
    .slice(0, planDays);

  if (normalizedLegacy.length === planDays) return normalizedLegacy;

  const filled = new Map<number, (typeof normalizedLegacy)[number]>();
  normalizedLegacy.forEach((day) => filled.set(day.day_index, day));

  const days = Array.from({ length: planDays }).map((_, idx) => {
    const dayIndex = idx + 1;
    const existing = filled.get(dayIndex);
    if (existing) return existing;

    const action = actions[idx % actions.length] || actions[0];
    return {
      day_index: dayIndex,
      label: `Day ${dayIndex}`,
      focus: action ? `Lock in: ${action.title}` : "Execution rebuild",
      tasks: ensureTasks(dayIndex),
    };
  });

  return days;
}

function normalizeProbes(raw: any, actions: Report["next_actions"]) {
  const fromRaw = raw?.probes ?? raw?.probe_pack ?? raw?.meta?.probes ?? [];
  const probes = Array.isArray(fromRaw) ? fromRaw : [];

  const fallback = actions.slice(0, 4).map((action, idx) => ({
    title: `Probe: ${action.title}`,
    duration_min: clamp(Math.round(action.duration_min * 0.6), 10, 45),
    instructions: `Run a short drill focused only on "${action.title}". Track whether you followed the rule on every question.`,
    success_check: `You can follow the rule in ${action.title.toLowerCase()} without breaking it under time pressure.`,
    _idx: idx,
  }));

  const merged = (probes.length ? probes : fallback).slice(0, 5);

  return merged.map((probe: any, idx: number) => {
    const title = String(probe?.title || probe?.name || `Probe ${idx + 1}`);
    return {
      id: slugify(title, `probe-${idx + 1}`),
      title,
      duration_min: parseDurationToMinutes(probe?.duration_min ?? probe?.minutes, 20),
      instructions: String(
        probe?.instructions || probe?.description || "Run the drill and log whether the target rule holds."
      ),
      success_check: String(
        probe?.success_check || probe?.success_metric || "You can repeat the drill with stable accuracy."
      ),
    };
  });
}

function normalizeNextMockStrategy(raw: any, primaryBottleneck: string, actions: Report["next_actions"]) {
  const strategy = raw?.next_mock_strategy || raw?.nextMockStrategy || {};
  const legacyStrategy = raw?.strategy || {};
  const strategyPlan = raw?.meta?.strategy_plan || {};

  const rules = Array.isArray(strategy?.rules)
    ? strategy.rules
    : Array.isArray(legacyStrategy?.attempt_rules)
    ? legacyStrategy.attempt_rules
    : Array.isArray(strategyPlan?.if_then_rules)
    ? strategyPlan.if_then_rules
    : [];

  const timeCheckpoints = Array.isArray(strategy?.time_checkpoints)
    ? strategy.time_checkpoints
    : Array.isArray(strategy?.timeCheckpoints)
    ? strategy.timeCheckpoints
    : [];

  const skipPolicy = Array.isArray(strategy?.skip_policy)
    ? strategy.skip_policy
    : Array.isArray(strategy?.skipPolicy)
    ? strategy.skipPolicy
    : [];

  const fallbackRules = [
    `Protect marks first: secure all easy-medium questions before chasing upside in ${primaryBottleneck.toLowerCase()}.`,
    "Use a strict attempt/skip rule: decide within 20 seconds whether the question is pass-1 eligible.",
    actions[0]
      ? `Enforce your primary lever: ${actions[0].title}.`
      : "Enforce your primary lever even if confidence dips mid-section.",
  ];

  const fallbackCheckpoints = [
    "Checkpoint 1: 25% time elapsed → ensure you are not stuck on a single question.",
    "Checkpoint 2: 60% time elapsed → switch to damage-control mode if behind plan.",
    "Checkpoint 3: final 10 minutes → attempt only high-certainty questions.",
  ];

  const fallbackSkip = [
    "Skip immediately if you cannot define the approach within 20 seconds.",
    "Abort if a question crosses your time cap without clear progress.",
    "Never guess to compensate for lost time; reallocate instead.",
  ];

  return {
    rules: (rules.length ? rules : fallbackRules).map(String).slice(0, 8),
    time_checkpoints: (timeCheckpoints.length ? timeCheckpoints : fallbackCheckpoints)
      .map(String)
      .slice(0, 6),
    skip_policy: (skipPolicy.length ? skipPolicy : fallbackSkip).map(String).slice(0, 6),
  };
}

function normalizeOverallStrategy(raw: any, historyNote: string | null) {
  const overall = raw?.overall_exam_strategy || raw?.overallExamStrategy || {};

  const weeklyRhythm = Array.isArray(overall?.weekly_rhythm) ? overall.weekly_rhythm : [];
  const revisionLoop = Array.isArray(overall?.revision_loop) ? overall.revision_loop : [];
  const mockSchedule = Array.isArray(overall?.mock_schedule) ? overall.mock_schedule : [];

  const fallbackWeekly = [
    "2 focused improvement blocks on weekdays (decision drills + review).",
    "1 medium-length mixed set to stress-test pacing rules.",
    "1 mock + 45-minute post-mock review window every week.",
  ];

  const fallbackRevision = [
    "After every timed set, log the top 3 decision mistakes.",
    "Convert each mistake into a one-line if-then rule.",
    "Rehearse those rules before the next timed practice.",
  ];

  const fallbackMock = [
    "Minimum: 1 full mock per week.",
    "If the next mock is within 7 days, prioritize execution drills over new topics.",
  ];

  const weekly = (weeklyRhythm.length ? weeklyRhythm : fallbackWeekly).map(String);
  if (historyNote) weekly.unshift(historyNote);

  return {
    weekly_rhythm: weekly.slice(0, 7),
    revision_loop: (revisionLoop.length ? revisionLoop : fallbackRevision).map(String).slice(0, 7),
    mock_schedule: (mockSchedule.length ? mockSchedule : fallbackMock).map(String).slice(0, 6),
  };
}

function normalizeFollowups(raw: any, signalQuality: "low" | "medium" | "high", profile?: ProfileSignals | null) {
  const followupsRaw = Array.isArray(raw?.followups) ? raw.followups : [];
  const mapped = followupsRaw
    .map((item: any, idx: number) => {
      const type = String(item?.type || "text").toLowerCase();
      const normalizedType = type === "single" || type === "single_select" ? "single" : "text";
      const options = Array.isArray(item?.options) ? item.options.map(String).slice(0, 6) : undefined;
      const question = String(item?.question || "").trim();
      if (!question) return null;
      return {
        id: String(item?.id || `followup-${idx + 1}`),
        question,
        type: normalizedType as "single" | "text",
        ...(options && options.length ? { options } : {}),
      };
    })
    .filter(Boolean) as Report["followups"];

  if (signalQuality !== "low") return mapped.slice(0, 4);

  const fallback: Report["followups"] = [
    {
      id: "followup-next-mock-date",
      question: "When is your next mock (approx date)?",
      type: "text",
    },
    {
      id: "followup-daily-minutes",
      question: "How many minutes can you study daily this week?",
      type: "text",
    },
    {
      id: "followup-struggle",
      question: "What hurts more right now?",
      type: "single",
      options: ["Time pressure", "Accuracy drops", "Concept gaps", "Panic / tilt"],
    },
  ];

  const merged = mapped.length ? mapped : fallback;
  if (!profile?.nextMockDate) return merged.slice(0, 4);
  return merged.filter((item) => item.id !== "followup-next-mock-date").slice(0, 4);
}

function computePlanDays(planDays: number | undefined, profile?: ProfileSignals | null) {
  const explicit = Number(planDays);
  if (Number.isFinite(explicit) && explicit >= 3) return clamp(Math.round(explicit), 3, 14);

  const nextMockDate = profile?.nextMockDate ? new Date(profile.nextMockDate) : null;
  if (nextMockDate && !Number.isNaN(nextMockDate.getTime())) {
    const diffMs = nextMockDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (Number.isFinite(diffDays)) return clamp(diffDays, 3, 14);
  }

  return 7;
}

function normalizeSummary(raw: any, primaryBottleneck: string, signalQuality: "low" | "medium" | "high") {
  const summary = String(raw?.summary || "").trim();
  if (summary) return summary;
  if (signalQuality === "low") {
    return `Signal quality is low, so we are prioritizing robust execution fixes. Your primary bottleneck appears to be ${primaryBottleneck.toLowerCase()}. Follow the next actions, run the probes, and upload your next mock with sectional attempts/accuracy/timing so the coach can sharpen your plan.`;
  }
  return `Your latest mock points to ${primaryBottleneck.toLowerCase()} as the primary bottleneck. The plan below focuses on eliminating score leakage before chasing upside.`;
}

export function normalizeReport(rawReport: any, context: NormalizeContext): Report {
  const raw = rawReport && typeof rawReport === "object" ? rawReport : {};
  const planDays = computePlanDays(context.planDays, context.profile || null);
  const signalQuality = computeSignalQualityBand(raw);
  const confidence = computeConfidence(raw, signalQuality);
  const primaryBottleneck = derivePrimaryBottleneck(raw, context.profile || null);
  const summary = normalizeSummary(raw, primaryBottleneck, signalQuality);

  const historyNote = deriveHistoryNote(context.history);

  const patterns = normalizePatterns(raw, primaryBottleneck);
  const nextActions = normalizeActions(raw, primaryBottleneck, context.profile || null);
  const planDaysNormalized = normalizePlanDays({
    raw,
    planDays,
    actions: nextActions,
    profile: context.profile || null,
  });
  const probes = normalizeProbes(raw, nextActions);
  const nextMockStrategy = normalizeNextMockStrategy(raw, primaryBottleneck, nextActions);
  const overallStrategy = normalizeOverallStrategy(raw, historyNote);
  const followups = normalizeFollowups(raw, signalQuality, context.profile || null);

  const createdAt = toIsoString(context.createdAt);
  const reportId = context.reportId || nanoid(12);
  const attemptId = context.attemptId || String(raw?.attempt_id || raw?.attemptId || "");

  const meta = {
    ...(raw?.meta && typeof raw.meta === "object" ? raw.meta : {}),
    plan_days: planDays,
    normalized_at: createdAt,
    history_used: Array.isArray(context.history) ? context.history.length : 0,
  } as Record<string, unknown>;

  const normalized = ReportSchema.parse({
    report_id: reportId,
    user_id: context.userId,
    attempt_id: attemptId || "pending-attempt",
    created_at: createdAt,
    signal_quality: signalQuality,
    confidence,
    primary_bottleneck: primaryBottleneck,
    summary,
    patterns,
    next_actions: nextActions,
    plan: { days: planDaysNormalized },
    probes,
    next_mock_strategy: nextMockStrategy,
    overall_exam_strategy: overallStrategy,
    followups,
    meta,
  });

  if (DEV_LOG) {
    console.debug("[report.normalize]", {
      rawKeys: Object.keys(raw || {}),
      planDays,
      nextActions: normalized.next_actions.length,
      probes: normalized.probes.length,
      signalQuality: normalized.signal_quality,
    });
  }

  return normalized;
}
