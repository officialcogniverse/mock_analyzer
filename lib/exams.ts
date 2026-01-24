export const KNOWN_EXAMS = ["CAT", "NEET", "JEE"] as const;

export type KnownExam = (typeof KNOWN_EXAMS)[number];

// Exam is now metadata and can be any string label.
export type Exam = string;

export function isKnownExam(value: string): value is KnownExam {
  return KNOWN_EXAMS.includes(value as KnownExam);
}

export function normalizeExam(value?: string | null): string | null {
  const x = String(value || "").trim();
  if (!x) return null;
  return x.toUpperCase();
}

export function formatExamLabel(value?: string | null): string {
  const normalized = normalizeExam(value);
  if (!normalized) return "";
  return isKnownExam(normalized) ? normalized : normalized.slice(0, 24);
}
