export function respondWithEiTemplate(message: string) {
  const normalized = message.toLowerCase();
  const frictionSignals: string[] = [];
  if (normalized.includes("burnout") || normalized.includes("tired")) {
    frictionSignals.push("fatigue");
  }
  if (normalized.includes("stress") || normalized.includes("anxious")) {
    frictionSignals.push("stress");
  }

  return {
    insights: [
      "You’re noticing the emotions tied to performance, which is a strong first step.",
      "Small, repeatable actions reduce overwhelm and build consistency.",
    ],
    controllableFactors: [
      "Sleep and recovery cadence",
      "Short daily review blocks",
      "Environment setup before a mock",
    ],
    uncontrollableFactors: ["Exam-day surprises", "Past results"],
    nextSteps: [
      "Pick one action from today’s checklist and complete it in 20 minutes.",
      "Write down one thing you did well in the last attempt.",
    ],
    frictionSignals,
  };
}
