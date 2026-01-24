export const sampleReportPayload = {
  id: "sample",
  createdAt: new Date().toISOString(),
  exam: "CAT",
  report: {
    summary:
      "Your mock shows strong comprehension but uneven execution under time pressure. The primary leakage is spending too long on mid-difficulty questions, which limits easy wins. Data is partial, so this report uses conservative assumptions.",
    facts: {
      metrics: [
        {
          label: "Attempted questions",
          value: "58",
          evidence: "Attempted: 58",
        },
        {
          label: "Accuracy",
          value: "62%",
          evidence: "Accuracy: 62%",
        },
      ],
      notes: ["Scorecard text was partial."],
    },
    inferences: [
      {
        hypothesis: "You over-invest time in mid-level questions before clearing easy wins.",
        confidence: "medium",
        evidence: "Partial timing cues + low easy-win volume in text.",
      },
    ],
    patterns: [
      {
        title: "Mid-difficulty time sink",
        evidence: "Long time per question noted in remarks.",
        impact: "Easy questions remain unattempted late in the mock.",
        fix: "Adopt a 2-pass rule with a 90-second cap in pass 1.",
      },
      {
        title: "Late-stage accuracy dip",
        evidence: "Accuracy drops after fatigue cues.",
        impact: "Negative marking risk in last 20% of the test.",
        fix: "Add a hard-stop review window in the final 8 minutes.",
      },
    ],
    next_actions: [
      {
        title: "Pass-1 timing cap",
        duration: "Next 2 mocks",
        expected_impact: "Reduce time leakage and unlock easy wins.",
        steps: ["90s cap per question", "Mark and move on", "Return only if time remains"],
      },
      {
        title: "Error log sprint",
        duration: "30 min today",
        expected_impact: "Fix top mistake bucket before next mock.",
        steps: ["Tag last 10 errors", "Pick top 1 bucket", "Drill 12 targeted items"],
      },
    ],
    strategy: {
      next_mock_script: [
        "Pass 1: scan all sections, capture only sure wins.",
        "Hard stop at 90 seconds per item in pass 1.",
        "Final 8 minutes = accuracy audit + marked items only.",
      ],
      attempt_rules: [
        "Skip immediately if two steps don’t resolve in 30 seconds.",
        "No blind guesses in last 5 minutes.",
      ],
    },
    followups: [
      {
        id: "next_mock_date",
        question: "When is your next mock (approx date)?",
        type: "text",
        reason: "Plan length depends on your timeline.",
      },
    ],
    meta: {
      engine: "sample",
      prompt_version: "sample-v2",
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
    streak_days: 4,
    weekly_activity: 3,
    responsiveness: "medium",
    delta_xp: 6,
    stuck_loop: { active: false, topic: null },
    execution_style: "methodical",
    confidence: "steady",
    evidence: ["Consistent weekly practice cadence."],
  },
};

export const sampleNextActions = [
  {
    id: "pass-1",
    title: "Pass-1 timebox",
    steps: ["90s cap per question", "Mark & move"],
    metric: "<= 90s avg in pass 1",
    expectedImpact: "High",
    effort: "Medium",
    evidence: ["Time leakage noted in remarks."],
    why: "Protect easy wins and reduce late-stage panic.",
    duration: "Next 2 mocks",
    difficulty: "Medium",
  },
];
