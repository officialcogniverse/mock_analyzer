import { nanoid } from "nanoid";

import type { NBAAction, NormalizedAttempt } from "@/lib/schemas/workflow";

type StrategyContext = {
  id: string;
  exam: string;
  persona: string;
  horizonDays: 7 | 14;
};

function pushAction(actions: NBAAction[], action: Omit<NBAAction, "id">) {
  const existing = actions.find((item) => item.title === action.title);
  if (existing) return;
  actions.push({ ...action, id: nanoid() });
}

export function buildNbas(params: {
  attempt: NormalizedAttempt;
  strategy: StrategyContext;
}): NBAAction[] {
  const { attempt, strategy } = params;
  const actions: NBAAction[] = [];
  const accuracy = attempt.known.accuracy;
  const score = attempt.known.score;
  const weakestSection = attempt.known.sections?.find((section) => (section.accuracy ?? 100) < 75);

  if (attempt.missing.includes("score") || attempt.missing.includes("accuracy")) {
    pushAction(actions, {
      title: "Reconstruct your scorecard + error log",
      why: "Core metrics are missing, so we need a clear error log before tightening the plan.",
      expectedImpact: "Establishes a reliable baseline and prevents guessing about priorities.",
      effortLevel: "S",
      timeHorizon: "Today",
      successCriteria: ["Logged at least 15 misses with root cause tags.", "Captured total score + accuracy."],
      tags: ["baseline", "accuracy"],
    });
  }

  if (accuracy !== undefined && accuracy <= 70) {
    pushAction(actions, {
      title: "Redo missed questions with a 2-pass review",
      why: "Low accuracy signals concept gaps or rushed choices; a structured redo closes the loop.",
      expectedImpact: "Reduces avoidable errors and stabilizes accuracy.",
      effortLevel: "M",
      timeHorizon: "ThisWeek",
      successCriteria: ["Redo set completed with >80% accuracy.", "Top 5 error patterns noted."],
      tags: ["accuracy", "concept-gap"],
    });
  }

  if (accuracy !== undefined && accuracy >= 85 && score !== undefined && score < 60) {
    pushAction(actions, {
      title: "Timed set focused on pacing + question selection",
      why: "High accuracy but lower score indicates pacing and attempt strategy gaps.",
      expectedImpact: "Improves score by raising attempts without sacrificing accuracy.",
      effortLevel: "M",
      timeHorizon: "ThisWeek",
      successCriteria: ["Completed 2 timed sets within target pace.", "Attempts per section increased."],
      tags: ["speed", "strategy"],
    });
  }

  if (weakestSection?.name) {
    pushAction(actions, {
      title: `Repair ${weakestSection.name} fundamentals`,
      why: `${weakestSection.name} is dragging the overall mock performance.`,
      expectedImpact: "Lifts the lowest section to remove score volatility.",
      effortLevel: "M",
      timeHorizon: "Next14Days",
      successCriteria: ["Completed a focused drill set for the section.", "Section accuracy improved in practice."],
      tags: ["sectional", "concept-gap"],
    });
  }

  pushAction(actions, {
    title: "Mini-mock + post-review ritual",
    why: "Short mocks lock in the plan and surface the next bottleneck quickly.",
    expectedImpact: "Confirms improvement and keeps momentum measurable.",
    effortLevel: "L",
    timeHorizon: strategy.horizonDays === 14 ? "Next14Days" : "ThisWeek",
    successCriteria: ["Mini-mock completed and reviewed within 24 hours."],
    tags: ["review", "consistency"],
  });

  if (actions.length < 3) {
    pushAction(actions, {
      title: "Create a 3-metric tracker (score, accuracy, time)",
      why: "We need consistent signals to personalize the next iteration.",
      expectedImpact: "Improves clarity on what is improving and what is stalling.",
      effortLevel: "S",
      timeHorizon: "Today",
      successCriteria: ["Tracker filled for this mock and next practice set."],
      tags: ["baseline", "planning"],
    });
  }

  if (actions.length < 3) {
    pushAction(actions, {
      title: "Redo the hardest 10 questions from this mock",
      why: "A focused redo exposes the exact skill gaps before the next attempt.",
      expectedImpact: "Builds accuracy and confidence on high-impact items.",
      effortLevel: "M",
      timeHorizon: "ThisWeek",
      successCriteria: ["Redo set completed with written fixes for each miss."],
      tags: ["review", "concept-gap"],
    });
  }

  return actions.slice(0, 5);
}
