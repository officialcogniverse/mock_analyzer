import { detectExamFromText } from "@/lib/examDetect";
import type { NormalizedAttempt } from "@/lib/schemas/workflow";

const SECTION_KEYWORDS = [
  "section",
  "quant",
  "verbal",
  "lrdi",
  "dilr",
  "reading",
  "english",
  "math",
  "physics",
  "chemistry",
  "biology",
];

function parseNumeric(value: string | undefined) {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function extractScore(text: string) {
  const match = text.match(/score\s*[:\-]?\s*(\d{1,3})/i);
  return parseNumeric(match?.[1]);
}

function extractAccuracy(text: string) {
  const match = text.match(/accuracy\s*[:\-]?\s*(\d{1,3})%?/i);
  return parseNumeric(match?.[1]);
}

function extractSections(text: string) {
  const lines = text.split(/\n|;/).map((line) => line.trim()).filter(Boolean);
  const sections: Array<{ name: string; score?: number; accuracy?: number }> = [];

  for (const line of lines) {
    const match = line.match(/^(?<name>[A-Za-z &/]+)\s*[:\-]\s*(?<rest>.+)$/);
    if (!match?.groups?.name || !match.groups.rest) continue;
    const name = match.groups.name.trim();
    const keywordHit = SECTION_KEYWORDS.some((keyword) => name.toLowerCase().includes(keyword));
    if (!keywordHit) continue;
    const scoreMatch = match.groups.rest.match(/score\s*[:\-]?\s*(\d{1,3})/i) ?? match.groups.rest.match(/(\d{1,3})\s*\/\s*\d{1,3}/);
    const accuracyMatch = match.groups.rest.match(/accuracy\s*[:\-]?\s*(\d{1,3})%?/i) ?? match.groups.rest.match(/(\d{1,3})%/);
    const score = parseNumeric(scoreMatch?.[1]);
    const accuracy = parseNumeric(accuracyMatch?.[1]);
    if (score !== undefined || accuracy !== undefined) {
      sections.push({ name, score, accuracy });
    }
  }

  return sections.length ? sections : undefined;
}

function extractionQuality(rawText: string): "high" | "medium" | "low" {
  if (rawText.length > 1200) return "high";
  if (rawText.length > 400) return "medium";
  return "low";
}

export function analyzeMock(rawText: string): {
  attempt: NormalizedAttempt;
  exam: { detected?: string; confidence?: number };
} {
  const score = extractScore(rawText);
  const accuracy = extractAccuracy(rawText);
  const sections = extractSections(rawText);

  const missing = [];
  if (score === undefined) missing.push("score");
  if (accuracy === undefined) missing.push("accuracy");
  if (!sections?.length) missing.push("sections");
  if (rawText.length < 80) missing.push("insufficient_text");

  const detectedExam = rawText ? detectExamFromText(rawText) : null;

  return {
    attempt: {
      known: {
        score,
        accuracy,
        sections,
      },
      inferred: {},
      missing,
      artifacts: {
        extractionQuality: extractionQuality(rawText),
      },
    },
    exam: detectedExam ? { detected: detectedExam, confidence: 0.6 } : {},
  };
}
