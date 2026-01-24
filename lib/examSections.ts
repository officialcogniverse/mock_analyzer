import { type KnownExam, KNOWN_EXAMS } from "./exams";

export type ExamSection = {
  name: string;
  aliases?: string[];
};

const CAT_SECTIONS: ExamSection[] = [
  { name: "VARC", aliases: ["verbal", "reading comprehension"] },
  { name: "DILR", aliases: ["lrdi", "logical reasoning"] },
  { name: "QA", aliases: ["quant", "quantitative", "mathematics"] },
];

const NEET_SECTIONS: ExamSection[] = [
  { name: "Physics" },
  { name: "Chemistry" },
  { name: "Biology", aliases: ["botany", "zoology"] },
];

const JEE_SECTIONS: ExamSection[] = [
  { name: "Physics" },
  { name: "Chemistry" },
  { name: "Mathematics", aliases: ["maths"] },
];

export const EXAM_SECTIONS: Record<KnownExam, ExamSection[]> = {
  CAT: CAT_SECTIONS,
  NEET: NEET_SECTIONS,
  JEE: JEE_SECTIONS,
};

export const SECTION_TIME_TARGETS: Record<KnownExam, Record<string, number>> = {
  CAT: { VARC: 40, DILR: 40, QA: 40 },
  NEET: { Physics: 45, Chemistry: 45, Biology: 90 },
  JEE: { Physics: 60, Chemistry: 60, Mathematics: 60 },
};

export function normalizeSectionName(exam: KnownExam, raw: string): string {
  const sections = EXAM_SECTIONS[exam] || [];
  const cleaned = String(raw || "").trim().toLowerCase();
  const match = sections.find((section) => {
    if (section.name.toLowerCase() === cleaned) return true;
    return (section.aliases || []).some((alias) => alias.toLowerCase() === cleaned);
  });
  return match?.name || raw;
}

export function buildSectionSchema(exam: KnownExam) {
  return EXAM_SECTIONS[exam].map((section, index) => ({
    index,
    name: section.name,
    time_target: SECTION_TIME_TARGETS[exam]?.[section.name] ?? null,
  }));
}

export function normalizeSectionBreakdown(exam: KnownExam, report: any) {
  const sections = EXAM_SECTIONS[exam] || [];
  if (!sections.length) return report;

  const raw = report?.section_breakdown || report?.sections || [];
  if (!Array.isArray(raw)) return report;

  const normalized = raw.map((item: any) => {
    const rawName = String(item?.section || item?.name || "").trim();
    const label = normalizeSectionName(exam, rawName);
    return { ...item, section: label };
  });

  return {
    ...report,
    section_breakdown: normalized,
    meta: {
      ...report?.meta,
      section_schema: buildSectionSchema(exam),
    },
  };
}

export function isKnownExamSection(exam: string | null): exam is KnownExam {
  return KNOWN_EXAMS.includes(String(exam || "").toUpperCase() as KnownExam);
}
