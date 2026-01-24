import { type Exam } from "./exams";

export type ExamSection = {
  key: string;
  label: string;
  aliases: string[];
};

const CAT_SECTIONS: ExamSection[] = [
  {
    key: "varc",
    label: "VARC",
    aliases: ["verbal", "verbal ability", "reading comprehension", "rc"],
  },
  {
    key: "dilr",
    label: "DILR",
    aliases: ["lrdi", "lr", "di", "data interpretation", "logical reasoning"],
  },
  {
    key: "qa",
    label: "QA",
    aliases: ["quant", "quantitative ability", "quantitative aptitude", "maths"],
  },
];

const NEET_SECTIONS: ExamSection[] = [
  {
    key: "physics",
    label: "Physics",
    aliases: ["phy"],
  },
  {
    key: "chemistry",
    label: "Chemistry",
    aliases: ["chem"],
  },
  {
    key: "biology",
    label: "Biology",
    aliases: ["bio", "botany", "zoology"],
  },
];

const JEE_SECTIONS: ExamSection[] = [
  {
    key: "physics",
    label: "Physics",
    aliases: ["phy"],
  },
  {
    key: "chemistry",
    label: "Chemistry",
    aliases: ["chem"],
  },
  {
    key: "mathematics",
    label: "Mathematics",
    aliases: ["math", "maths"],
  },
];

export const EXAM_SECTIONS: Record<Exam, ExamSection[]> = {
  CAT: CAT_SECTIONS,
  NEET: NEET_SECTIONS,
  JEE: JEE_SECTIONS,
};

export const SECTION_TIME_TARGETS: Record<Exam, Record<string, number>> = {
  CAT: {
    VARC: 40,
    DILR: 40,
    QA: 40,
  },
  NEET: {
    Physics: 45,
    Chemistry: 45,
    Biology: 90,
  },
  JEE: {
    Physics: 60,
    Chemistry: 60,
    Mathematics: 60,
  },
};

function normalizeLabel(value: string) {
  return value.replace(/[^a-z0-9]/gi, " ").toLowerCase().trim();
}

export function normalizeSectionName(exam: Exam, raw: string): string {
  const sections = EXAM_SECTIONS[exam] || [];
  const normalized = normalizeLabel(raw);

  for (const section of sections) {
    if (normalizeLabel(section.label) === normalized) return section.label;
    if (normalizeLabel(section.key) === normalized) return section.label;
    if (section.aliases.some((alias) => normalizeLabel(alias) === normalized)) {
      return section.label;
    }
  }

  return raw.trim();
}

export function buildSectionSchema(exam: Exam) {
  return EXAM_SECTIONS[exam].map((section, index) => ({
    key: section.key,
    label: section.label,
    order: index + 1,
  }));
}

export function normalizeSectionBreakdown(exam: Exam, report: any) {
  const sections = EXAM_SECTIONS[exam] || [];
  if (!sections.length) return report;

  const seen = new Map<string, any>();

  const tryAdd = (rawName: string, payload: any) => {
    const label = normalizeSectionName(exam, rawName);
    seen.set(label, { ...payload, name: label, section: label, label });
  };

  const source =
    Array.isArray(report?.section_breakdown)
      ? report.section_breakdown
      : Array.isArray(report?.sections)
      ? report.sections
      : Array.isArray(report?.sectionWise)
      ? report.sectionWise
      : null;

  if (source) {
    source.forEach((entry: any) => {
      const raw =
        entry?.section || entry?.name || entry?.label || entry?.title || entry?.subject;
      if (!raw) return;
      tryAdd(String(raw), entry);
    });
  }

  if (exam !== "CAT") {
    const fieldMap = [
      { label: "Physics", key: "physics" },
      { label: "Chemistry", key: "chemistry" },
      { label: "Mathematics", key: "mathematics" },
      { label: "Mathematics", key: "maths" },
      { label: "Biology", key: "biology" },
    ];

    fieldMap.forEach((item) => {
      const raw = report?.[item.key];
      if (raw && typeof raw === "object") {
        tryAdd(item.label, raw);
      }
    });
  }

  const normalized = sections.map((section) => {
    const existing = seen.get(section.label);
    return (
      existing || {
        name: section.label,
        section: section.label,
        label: section.label,
        attempts: null,
        correct: null,
        incorrect: null,
        accuracy: null,
        score: null,
      }
    );
  });

  return {
    ...report,
    section_breakdown: normalized,
    section_schema: buildSectionSchema(exam),
  };
}
