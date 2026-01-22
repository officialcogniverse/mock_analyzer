export const sampleReportPayload = {
  id: "sample",
  createdAt: new Date().toISOString(),
  exam: "CAT",
  report: {
    summary:
      "Your mock shows strong VARC comprehension but time leaks in DILR and QA. The biggest bottleneck is spending too long on mid-level sets, which drags down accuracy and leaves easy points unattempted.",
    estimated_score: {
      value: 82,
      max: 198,
      range: [78, 88],
      confidence: "medium",
      assumptions: [
        "Section timing inferred from question order.",
        "Accuracy based on incomplete per-section split.",
      ],
    },
    strengths: ["Reading comprehension accuracy", "Elimination-based solving"],
    weaknesses: [
      {
        topic: "DILR set selection",
        severity: 5,
        reason: "Spent 18+ minutes on a single complex set.",
      },
      {
        topic: "QA speed traps",
        severity: 4,
        reason: "Solved mid-difficulty questions first, missing easy wins.",
      },
      {
        topic: "Late-section accuracy",
        severity: 3,
        reason: "Accuracy dipped in final 20% of the mock.",
      },
    ],
    error_types: {
      conceptual: 28,
      careless: 22,
      time: 35,
      comprehension: 15,
    },
    top_actions: [
      "Do 2 timed DILR sets with 12-min hard stop each, twice this week.",
      "Complete 20 QA easy wins daily before touching mid-level questions.",
      "Review all wrong answers and tag them by error type within 24 hours.",
    ],
    fourteen_day_plan: Array.from({ length: 14 }, (_, idx) => ({
      day: idx + 1,
      focus: idx % 2 === 0 ? "DILR + QA speed" : "VARC + review",
      time_minutes: 40,
      tasks: [
        "1 timed section (30–40 min).",
        "2 mini-drills on weak topics.",
        "15-min review + error tagging.",
      ],
    })),
    next_mock_strategy: [
      "Start with two easiest sets; hard stop at 12 minutes per set.",
      "Reserve final 10 minutes for accuracy check and marked questions.",
    ],
    meta: {
      engine: "sample",
      prompt_version: "sample-v1",
      strategy_plan: {
        confidence: {
          score: 72,
          band: "medium",
          assumptions: ["Section timing inferred from attempt order."],
          missing_signals: ["Exact question-level timestamps"],
        },
        top_levers: [
          {
            title: "DILR set selection discipline",
            do: [
              "Scan all sets in 3 minutes and shortlist 2.",
              "Hard stop at 12 minutes if no progress.",
            ],
            stop: ["Chasing complex sets past 12 minutes."],
            why: "Your DILR time sink is the biggest score drag.",
            metric: "Attempted sets with hard stop",
            next_mock_rule: "Max 2 sets before minute 30.",
          },
          {
            title: "QA easy-first sequencing",
            do: ["Solve easy wins in first 12 minutes.", "Mark mid-level for later."],
            stop: ["Starting with time-heavy mid-level questions."],
            why: "You missed easy questions due to early time leakage.",
            metric: "Easy questions attempted before minute 15",
            next_mock_rule: "Complete 8 easy wins before mid-level.",
          },
        ],
        if_then_rules: [
          "If you miss 3 QA questions in a row, switch to easy bank.",
          "If DILR set hits 12 minutes, move on immediately.",
        ],
        next_questions: [
          {
            id: "calc_speed",
            question: "How many QA questions do you solve in 10 minutes?",
            options: ["2–3", "4–5", "6+"],
          },
        ],
      },
    },
  },
};

export const sampleInsights = {
  trend: "improving",
  dominant_error: "time",
  consistency: "medium",
  volatility: 38,
  risk_zone: "late_section_panic",
  personas: ["balanced striker"],
  learning_curve: [
    { index: 1, xp: 52, date: new Date(Date.now() - 86400000 * 21).toISOString() },
    { index: 2, xp: 60, date: new Date(Date.now() - 86400000 * 14).toISOString() },
    { index: 3, xp: 66, date: new Date(Date.now() - 86400000 * 7).toISOString() },
    { index: 4, xp: 72, date: new Date().toISOString() },
  ],
  learning_behavior: {
    cadence: "steady",
    streak_days: 3,
    weekly_activity: 2,
    responsiveness: "improving",
    delta_xp: 6,
    stuck_loop: { active: false, topic: null },
    execution_style: "speed_over_control",
    confidence: "medium",
    evidence: [
      "Consistent weekly cadence in the last 14 days.",
      "XP improved by 6 points compared to earlier mocks.",
    ],
  },
};

export const sampleLearningState = {
  attemptCount: 4,
  rollingScorePct: 68,
  lastDeltaScorePct: 4,
  rollingDeltaScorePct: 3,
  weakTopics: ["DILR set selection", "QA speed traps"],
  strategyConfidenceBand: "medium",
};

export const sampleNextActions = [
  {
    id: "dilr-selection",
    title: "Lock a 12-min hard stop per DILR set",
    steps: ["Scan sets in 3 minutes", "Attempt only 2 best-fit sets"],
    metric: "Sets stopped at 12 minutes",
    expectedImpact: "High",
    effort: "20 min",
    evidence: ["Time spikes in DILR", "Late-section panic signal"],
  },
  {
    id: "qa-easy-first",
    title: "Solve 8 easy QA questions before mid-levels",
    steps: ["Tag easy wins in practice", "Stick to the order in mock"],
    metric: "Easy-first completion rate",
    expectedImpact: "Medium",
    effort: "25 min",
    evidence: ["Missed easy wins", "Accuracy dip in final 20%"],
  },
  {
    id: "review-errors",
    title: "Review wrong answers within 24 hours",
    steps: ["Tag each error type", "Write 1 fix note"],
    metric: "Errors reviewed same day",
    expectedImpact: "Medium",
    effort: "15 min",
    evidence: ["Careless errors at 22%"],
  },
];

export const sampleProgressDoc = {
  exam: "CAT",
  nextMockInDays: 7,
  minutesPerDay: 40,
  probes: [],
  confidence: 62,
  probeMetrics: {},
};

export const sampleHistoryItems = [
  {
    id: "sample-6",
    exam: "CAT",
    createdAt: new Date(Date.now() - 86400000 * 35).toISOString(),
    summary: "Mock",
    focusXP: 46,
    estimatedScore: 66,
    errorTypes: { conceptual: 40, careless: 30, time: 20, comprehension: 10 },
  },
  {
    id: "sample-5",
    exam: "CAT",
    createdAt: new Date(Date.now() - 86400000 * 28).toISOString(),
    summary: "Mock",
    focusXP: 49,
    estimatedScore: 68,
    errorTypes: { conceptual: 38, careless: 30, time: 22, comprehension: 10 },
  },
  {
    id: "sample-4",
    exam: "CAT",
    createdAt: new Date().toISOString(),
    summary: "Latest mock",
    focusXP: 72,
    estimatedScore: 82,
    errorTypes: { conceptual: 28, careless: 22, time: 35, comprehension: 15 },
  },
  {
    id: "sample-3",
    exam: "CAT",
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    summary: "Mock",
    focusXP: 66,
    estimatedScore: 78,
    errorTypes: { conceptual: 30, careless: 25, time: 30, comprehension: 15 },
  },
  {
    id: "sample-2",
    exam: "CAT",
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    summary: "Mock",
    focusXP: 60,
    estimatedScore: 74,
    errorTypes: { conceptual: 34, careless: 28, time: 26, comprehension: 12 },
  },
  {
    id: "sample-1",
    exam: "CAT",
    createdAt: new Date(Date.now() - 86400000 * 21).toISOString(),
    summary: "Mock",
    focusXP: 52,
    estimatedScore: 70,
    errorTypes: { conceptual: 36, careless: 30, time: 22, comprehension: 12 },
  },
];
