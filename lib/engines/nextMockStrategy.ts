import type { NextMockStrategy, NormalizedAttempt } from "@/lib/schemas/workflow";

export function buildNextMockStrategy(attempt: NormalizedAttempt): NextMockStrategy {
  const accuracy = attempt.known.accuracy;
  const speedFocused = accuracy !== undefined && accuracy <= 70;
  const accuracyFocused = accuracy !== undefined && accuracy >= 85;

  const rules = [
    "Start with a 60-second scan to mark easy wins.",
    speedFocused
      ? "Attempt only high-confidence questions first; flag anything uncertain."
      : "Use a two-pass approach: easy → medium → revisit hard.",
    accuracyFocused
      ? "Do not change answers without concrete evidence."
      : "Limit rechecks to 2 per section to protect time.",
  ];

  const timeCheckpoints = [
    "Checkpoint 1: 25% of time → at least 30% questions attempted.",
    "Checkpoint 2: 60% of time → at least 65% questions attempted.",
    "Checkpoint 3: 85% of time → final review + flagged questions only.",
  ];

  const skipPolicy = [
    "Skip questions that exceed 90 seconds without progress.",
    "Skip any question with >2 unknown concepts on first read.",
    "Return only if there is time and confidence is high.",
  ];

  return { rules, timeCheckpoints, skipPolicy };
}
