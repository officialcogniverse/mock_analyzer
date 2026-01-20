export const EXAMS = ["CAT", "NEET", "JEE"] as const;

export type Exam = (typeof EXAMS)[number];

export function isExam(value: string): value is Exam {
  return EXAMS.includes(value as Exam);
}

export function normalizeExam(value?: string): Exam | null {
  const x = String(value || "").trim().toUpperCase();
  return isExam(x) ? x : null;
}
