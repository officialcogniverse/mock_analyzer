type SignalInputs = {
  profile: {
    examGoal?: string | null;
    weeklyHours?: number | null;
    baselineLevel?: string | null;
  };
  performance: {
    score?: number | null;
    accuracy?: number | null;
    sections?: string[] | null;
  };
  events: {
    recentCompletions?: number;
  };
  textHints?: string[];
};

export function normalizeSignals(input: SignalInputs) {
  const weeklyHours = input.profile.weeklyHours ?? 0;
  const paceBand =
    weeklyHours >= 12 ? "high" : weeklyHours >= 6 ? "medium" : "low";
  const accuracy = input.performance.accuracy ?? 0;
  const accuracyBand = accuracy >= 75 ? "high" : accuracy >= 55 ? "mid" : "low";
  const completions = input.events.recentCompletions ?? 0;

  return {
    examGoal: input.profile.examGoal ?? "General",
    paceBand,
    accuracyBand,
    baselineLevel: input.profile.baselineLevel ?? "unknown",
    completions,
    textHints: input.textHints ?? [],
  };
}

export function rankActions(signals: ReturnType<typeof normalizeSignals>) {
  const actions = [
    {
      id: "review-mistakes",
      title: "Review error patterns from the last mock",
      reason: "Fastest way to reduce repeat mistakes.",
      score: 90,
    },
    {
      id: "timed-section",
      title: "Run one timed section with strict cut-offs",
      reason: "Builds execution discipline under time pressure.",
      score: 80,
    },
    {
      id: "accuracy-drill",
      title: "Accuracy drill: 20 mixed questions, stop after 2 errors",
      reason: "Protects score from careless losses.",
      score: 75,
    },
    {
      id: "weak-area",
      title: "Target the weakest section with focused practice",
      reason: "Balances the score profile quickly.",
      score: 70,
    },
  ];

  if (signals.accuracyBand === "low") {
    actions[2].score += 10;
    actions[0].score += 5;
  }

  if (signals.paceBand === "low") {
    actions[1].score += 8;
  }

  if (signals.completions === 0) {
    actions[0].score += 6;
  }

  return actions.sort((a, b) => b.score - a.score);
}

export function buildPlan(signals: ReturnType<typeof normalizeSignals>) {
  const baseTasks = [
    "Analyze the last mock and tag top 3 mistakes.",
    "Timed section drill (45-60 minutes).",
    "Fix 10 errors with targeted practice.",
  ];

  const plan = Array.from({ length: 7 }, (_, index) => ({
    day: index + 1,
    title: `Day ${index + 1}: ${signals.examGoal} focus`,
    tasks: [...baseTasks],
  }));

  if (signals.paceBand === "low") {
    plan[1].tasks.push("Add a 20-minute speed burst drill.");
  }

  if (signals.accuracyBand === "low") {
    plan[2].tasks.push("Accuracy checkpoint: stop after 2 errors.");
  }

  return plan;
}
