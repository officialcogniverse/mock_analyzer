import { nanoid } from "nanoid";

import type { NormalizedAttempt, Probe } from "@/lib/schemas/workflow";

function addProbe(probes: Probe[], probe: Omit<Probe, "id">) {
  probes.push({ ...probe, id: nanoid() });
}

export function buildProbes(attempt: NormalizedAttempt): Probe[] {
  const probes: Probe[] = [];
  const accuracy = attempt.known.accuracy;
  const score = attempt.known.score;

  if (attempt.missing.includes("accuracy") || attempt.missing.includes("score")) {
    addProbe(probes, {
      title: "Rebuild the scorecard fast",
      durationMin: 15,
      instructions: "Recreate score + accuracy from this mock, then tag 10 misses with root causes.",
      successCheck: "You have score/accuracy plus at least 10 tagged misses.",
    });
  }

  if (accuracy !== undefined && accuracy <= 70) {
    addProbe(probes, {
      title: "Two-pass error redo",
      durationMin: 25,
      instructions: "Redo 10 missed questions. First pass: concept recall. Second pass: timed execution.",
      successCheck: "Redo set is ≥80% accurate with written fixes.",
    });
  }

  if (accuracy !== undefined && accuracy >= 85 && score !== undefined && score < 60) {
    addProbe(probes, {
      title: "Pacing sprint",
      durationMin: 20,
      instructions: "Run a 15-question timed set with strict time checkpoints.",
      successCheck: "You complete the set on time with ≥80% accuracy.",
    });
  }

  if (probes.length < 3) {
    addProbe(probes, {
      title: "Mini-mock checkpoint",
      durationMin: 30,
      instructions: "Run a mini-mock and write 3 quick takeaways on selection, time, and accuracy.",
      successCheck: "Mini-mock plus 3 takeaways are captured.",
    });
  }

  return probes.slice(0, 3);
}
