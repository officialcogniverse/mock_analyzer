import { type Exam } from "./exams";

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
    id: "neet-phy-sprint",
    title: "Physics speed sprint",
    section: "Physics",
    level: "Medium",
    questions: 12,
    minutes: 18,
    tags: ["physics", "time"],
    description: "Timed physics mixed set, 90 sec per question goal.",
  },
  {
    id: "neet-chem-memory",
    title: "Chemistry memory drill",
    section: "Chemistry",
    level: "Medium",
    questions: 15,
    minutes: 18,
    tags: ["chemistry", "concepts"],
    description: "Cover reactions + exceptions with spaced recall prompts.",
  },
];

const JEE_SETS: PracticeSet[] = [
  {
    id: "jee-phy-advanced",
    title: "Physics depth booster",
    section: "Physics",
    level: "Hard",
    questions: 8,
    minutes: 20,
    tags: ["physics", "concepts"],
    description: "Mixed conceptual set with post-solve derivation checks.",
  },
  {
    id: "jee-chem-balancing",
    title: "Chemistry balance set",
    section: "Chemistry",
    level: "Medium",
    questions: 10,
    minutes: 15,
    tags: ["chemistry", "accuracy"],
    description: "Alternate organic/inorganic questions to reduce fatigue.",
  },
  {
    id: "jee-math-sprint",
    title: "Maths accuracy sprint",
    section: "Mathematics",
    level: "Medium",
    questions: 10,
    minutes: 20,
    tags: ["math", "time"],
    description: "10 mixed questions with strict 2-min max each.",
  },
];

const EXAM_SETS: Record<Exam, PracticeSet[]> = {
  CAT: CAT_SETS,
  NEET: NEET_SETS,
  JEE: JEE_SETS,
};

function normalize(value: string) {
  return value.toLowerCase();
}

export function getPracticeSets(exam: Exam, weaknesses: Array<{ topic?: string }> = []) {
  const examSets = EXAM_SETS[exam] || [];
  const topics = weaknesses.map((w) => normalize(String(w?.topic || "")));

  const matched = examSets.filter((set) =>
    set.tags.some((tag) => topics.some((topic) => topic.includes(tag)))
  );

  const fallback = examSets.slice(0, 2);
  const combined = [...matched, ...fallback, ...COMMON_SETS];

  const unique = Array.from(new Map(combined.map((set) => [set.id, set])).values());
  return unique.slice(0, 5);
}
