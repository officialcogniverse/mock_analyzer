import { type KnownExam, isKnownExam } from "./exams";

export type PracticeSet = {
  id: string;
  title: string;
  section: string;
  level: "Easy" | "Medium" | "Hard";
  questions: number;
  minutes: number;
  tags: string[];
  description: string;
};

const COMMON_SETS: PracticeSet[] = [
  {
    id: "accuracy-checklist",
    title: "Accuracy reset sprint",
    section: "Mixed",
    level: "Easy",
    questions: 12,
    minutes: 15,
    tags: ["careless", "accuracy"],
    description: "Solve 12 easy wins with a 5-second final check before submit.",
  },
  {
    id: "time-checkpoints",
    title: "Timed checkpoints",
    section: "Mixed",
    level: "Medium",
    questions: 10,
    minutes: 12,
    tags: ["time", "pacing"],
    description: "Run a 12-min set with forced checkpoints at 4/8/12 min.",
  },
];

const CAT_SETS: PracticeSet[] = [
  {
    id: "cat-varc-rc",
    title: "VARC RC focus set",
    section: "VARC",
    level: "Medium",
    questions: 12,
    minutes: 20,
    tags: ["varc", "comprehension"],
    description: "2 RC passages + 4 VA questions, track time per passage.",
  },
  {
    id: "cat-dilr-selection",
    title: "DILR set selection",
    section: "DILR",
    level: "Hard",
    questions: 8,
    minutes: 24,
    tags: ["selection", "dilr"],
    description: "Scan 4 sets, pick 2, hard stop at 12 min each.",
  },
  {
    id: "cat-qa-easy-wins",
    title: "QA easy wins",
    section: "QA",
    level: "Easy",
    questions: 15,
    minutes: 18,
    tags: ["speed", "qa"],
    description: "Solve 15 easy/medium questions in strict order.",
  },
];

const NEET_SETS: PracticeSet[] = [
  {
    id: "neet-bio-accuracy",
    title: "Biology accuracy pack",
    section: "Biology",
    level: "Easy",
    questions: 20,
    minutes: 20,
    tags: ["bio", "accuracy"],
    description: "High-accuracy Biology set with NCERT-style questions.",
  },
  {
    id: "neet-physics-pacing",
    title: "Physics pacing drill",
    section: "Physics",
    level: "Medium",
    questions: 15,
    minutes: 18,
    tags: ["time", "physics"],
    description: "Timed Physics set with 6-min checkpoints.",
  },
];

const JEE_SETS: PracticeSet[] = [
  {
    id: "jee-math-speed",
    title: "Maths speed set",
    section: "Mathematics",
    level: "Medium",
    questions: 10,
    minutes: 15,
    tags: ["speed", "maths"],
    description: "Timed Math set with forced skip after 90s.",
  },
  {
    id: "jee-chem-accuracy",
    title: "Chemistry accuracy ladder",
    section: "Chemistry",
    level: "Easy",
    questions: 18,
    minutes: 15,
    tags: ["accuracy", "chemistry"],
    description: "Accuracy-first Chemistry sprint with 3-min reviews.",
  },
];

const EXAM_SETS: Record<KnownExam, PracticeSet[]> = {
  CAT: CAT_SETS,
  NEET: NEET_SETS,
  JEE: JEE_SETS,
};

export function getPracticeSets(exam: string, weaknesses: Array<{ topic?: string }> = []) {
  const examSets = isKnownExam(exam) ? EXAM_SETS[exam] || [] : [];
  const matched = examSets.filter((set) =>
    weaknesses.some((w) =>
      set.tags.some((tag) => String(w?.topic || "").toLowerCase().includes(tag))
    )
  );
  const fallback = examSets.slice(0, 2);
  const scoped = matched.length ? matched : fallback;
  return [...COMMON_SETS, ...scoped].slice(0, 4);
}
