import type { InsightBundle, NormalizedAttempt } from "@/lib/schemas/workflow";

function hasSectionSpread(sections?: Array<{ accuracy?: number }>) {
  if (!sections?.length) return false;
  const accuracies = sections.map((s) => s.accuracy).filter((value): value is number => value !== undefined);
  if (accuracies.length < 2) return false;
  const min = Math.min(...accuracies);
  const max = Math.max(...accuracies);
  return max - min >= 20;
}

function derivePersona(accuracy?: number, sections?: Array<{ accuracy?: number }>) {
  if (accuracy !== undefined) {
    if (accuracy >= 85) return "accuracy-first";
    if (accuracy <= 70) return "speed-first";
  }
  if (hasSectionSpread(sections)) return "volatile";
  return "steady";
}

export function buildInsights(attempt: NormalizedAttempt): InsightBundle {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];

  const accuracy = attempt.known.accuracy;
  const score = attempt.known.score;
  const sections = attempt.known.sections;

  if (accuracy !== undefined) {
    if (accuracy >= 85) strengths.push("Accuracy is holding strong, which means your answer selection is disciplined.");
    if (accuracy <= 70) weaknesses.push("Accuracy is low, signalling concept gaps or rushed choices.");
  }

  if (score !== undefined && accuracy !== undefined && accuracy >= 85 && score < 60) {
    weaknesses.push("Score lags despite high accuracy, pointing to pacing or attempt strategy gaps.");
  }

  if (sections?.length) {
    const weakest = [...sections].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0];
    if (weakest?.name && weakest.accuracy !== undefined && weakest.accuracy < 75) {
      weaknesses.push(`Section risk: ${weakest.name} accuracy trails the rest.`);
    }
    if (hasSectionSpread(sections)) {
      risks.push("Sectional volatility could cause score swings between mocks.");
    }
  }

  if (!strengths.length) strengths.push("Baseline strengths are still forming; focus on consistency to surface them.");
  if (!weaknesses.length) weaknesses.push("No clear weakness detected; keep pressure-testing with timed sets.");
  if (!risks.length) risks.push("Main risk is limited data; keep logs tight after each attempt.");

  const persona = derivePersona(accuracy, sections);
  const confidenceGap =
    accuracy !== undefined && accuracy >= 85 && score !== undefined && score < 60
      ? "High accuracy but lower score suggests pacing or attempt strategy gaps."
      : accuracy !== undefined && accuracy <= 70
        ? "Error rate implies missing concepts or rushed decisions."
        : undefined;

  const riskPatterns = risks.length ? risks : undefined;

  return {
    strengths,
    weaknesses,
    risks,
    known: attempt.known,
    inferred: {
      persona,
      riskPatterns,
      confidenceGap,
    },
    missing: attempt.missing,
  };
}
