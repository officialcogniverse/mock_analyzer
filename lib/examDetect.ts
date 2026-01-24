import { KNOWN_EXAMS, type KnownExam } from "@/lib/exams";

export function detectExamFromText(text: string): KnownExam | null {
  const t = text.toLowerCase();

  const catHits =
    (t.includes("varc") ? 1 : 0) +
    (t.includes("dilr") ? 1 : 0) +
    (t.includes("quant") ? 1 : 0) +
    (t.includes("percentile") ? 1 : 0) +
    (t.includes("cat") ? 1 : 0);

  const neetHits =
    (t.includes("neet") ? 2 : 0) +
    (t.includes("biology") ? 1 : 0) +
    (t.includes("botany") ? 1 : 0) +
    (t.includes("zoology") ? 1 : 0) +
    (t.includes("physics") ? 1 : 0) +
    (t.includes("chemistry") ? 1 : 0) +
    (t.includes("ncert") ? 1 : 0);

  const jeeHits =
    (t.includes("jee") ? 2 : 0) +
    (t.includes("mains") ? 1 : 0) +
    (t.includes("advanced") ? 1 : 0) +
    (t.includes("physics") ? 1 : 0) +
    (t.includes("chemistry") ? 1 : 0) +
    (t.includes("mathematics") ? 1 : 0) +
    (t.includes("maths") ? 1 : 0);

  const scores: Record<KnownExam, number> = {
    CAT: catHits,
    NEET: neetHits,
    JEE: jeeHits,
  };

  const best = (KNOWN_EXAMS as unknown as KnownExam[]).sort((a, b) => scores[b] - scores[a])[0];

  if (scores[best] < 3) return null;
  return best;
}
