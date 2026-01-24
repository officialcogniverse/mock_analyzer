import { KNOWN_EXAMS, type KnownExam, normalizeExam } from "@/lib/exams";

export type ExamPatternItem = {
  title: string;
  details: string;
};

export const EXAM_PATTERN_CHECKLIST: Record<KnownExam, ExamPatternItem[]> = {
  CAT: [
    {
      title: "Three sections, fixed order",
      details: "Plan a hard stop for each section so no single section eats the clock.",
    },
    {
      title: "Pass-based selection",
      details: "Two-pass approach: skim, shortlist, then execute.",
    },
    {
      title: "Accuracy protection",
      details: "Avoid late-guessing streaks. Exit if confidence drops.",
    },
  ],
  NEET: [
    {
      title: "High question volume",
      details: "Use speed ladders and time checkpoints to avoid mid-test fatigue.",
    },
    {
      title: "Negative marking",
      details: "Set a strict guessing threshold for low-confidence items.",
    },
    {
      title: "NCERT alignment",
      details: "Anchor revisions to NCERT phrasing for accuracy boosts.",
    },
  ],
  JEE: [
    {
      title: "Multi-step reasoning",
      details: "Mark long chains early; return after easy wins.",
    },
    {
      title: "Balanced subject split",
      details: "Avoid sinking time into a single subject early.",
    },
    {
      title: "Error mitigation",
      details: "Track the top 2 mistake types and address them daily.",
    },
  ],
};

export function getExamPatternChecklist(exam?: string | null) {
  const normalized = normalizeExam(exam || "");
  if (!normalized) return null;
  if (!KNOWN_EXAMS.includes(normalized as KnownExam)) return null;
  return EXAM_PATTERN_CHECKLIST[normalized as KnownExam];
}
