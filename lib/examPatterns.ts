import { EXAMS, type Exam, normalizeExam } from "@/lib/exams";

export type ExamPatternItem = {
  label: string;
  detail: string;
};

export const EXAM_PATTERN_CHECKLIST: Record<Exam, ExamPatternItem[]> = {
  CAT: [
    {
      label: "Section weight",
      detail: "VARC, DILR, QA are balanced; skipping one can sink percentile.",
    },
    {
      label: "Time pressure",
      detail: "Tight sectional timers demand pacing checkpoints every 10–12 min.",
    },
    {
      label: "Negative marking",
      detail: "Wrong answers penalize; accuracy control beats extra guesses.",
    },
    {
      label: "Question strategy",
      detail: "Smart selection + leaving traps is a rank-defining habit.",
    },
  ],
  NEET: [
    {
      label: "Section weight",
      detail: "Biology dominates; Physics + Chemistry decide rank jumps.",
    },
    {
      label: "Time pressure",
      detail: "Speed matters across 180 questions; 45–50 sec per question target.",
    },
    {
      label: "Negative marking",
      detail: "−1 per wrong; disciplined elimination protects score.",
    },
    {
      label: "Question strategy",
      detail: "Accuracy-first in Bio, timed sprints in Physics/Chem.",
    },
  ],
  JEE: [
    {
      label: "Section weight",
      detail: "Phy/Chem/Math balance varies by shift; keep all three warm.",
    },
    {
      label: "Time pressure",
      detail: "Mix of single + numerical types: pace for 90–100 sec per Q avg.",
    },
    {
      label: "Negative marking",
      detail: "MCQ penalties apply; leave low-confidence guesses.",
    },
    {
      label: "Question strategy",
      detail: "High ROI: solve easy wins first, then selective tough ones.",
    },
  ],
};

export function getExamPatternChecklist(exam?: string | null) {
  const normalized = normalizeExam(exam || "");
  if (!normalized) return null;
  if (!EXAMS.includes(normalized)) return null;
  return EXAM_PATTERN_CHECKLIST[normalized];
}
