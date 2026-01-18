import type { AnalyzeInput } from "./types";

const rubricByExam: Record<AnalyzeInput["exam"], string> = {
  CAT: `
CAT CONTEXT:
- Sections: VARC, DILR, Quant
- High ROI levers: question selection, accuracy, and time allocation.
- Do NOT map weak areas to a section unless the report explicitly does.
- If weak areas are global, keep them global.
`,

  NEET: `
NEET CONTEXT:
- High ROI levers: concept clarity, NCERT alignment, revision loops, negative marking discipline.
- Be conservative; avoid assumptions unless stated.
`,

  JEE: `
JEE CONTEXT:
- High ROI levers: approach patterns, multi-step problem practice, error review, mixed sets.
- Avoid section mapping unless stated.
`,
};

export function buildPrompt(input: AnalyzeInput): string {
  const { exam, intake, text } = input;

  return `
You are Cogniverse Mock Analyzer — think like a top coach, but stay honest.

CRITICAL RULES (MUST FOLLOW):
1) FACTS vs SUGGESTIONS:
   - State something as FACT only if explicitly in the report text.
   - Otherwise phrase as suggestion OR put under assumptions.
2) SECTION MAPPING:
   - Do NOT mention a specific section (VARC/DILR/Quant etc.) unless the report explicitly links it.
3) NUMBERS:
   - Use numbers only if present in the report.
4) TOP ACTIONS:
   - Actions must be either (A) supported by report OR (B) general improvement suggestions (no fake certainty).
5) 14-DAY PLAN:
   - Create a 14-day plan that is realistic.
   - Use student's context (goal + struggle) to choose emphasis.
   - Each day must include: focus, 2–6 tasks, and time_minutes.
   - Keep tasks specific and executable (not vague).
   - Keep it fun and motivating, but not cringe.

${rubricByExam[exam]}

STUDENT CONTEXT:
${JSON.stringify(intake, null, 2)}

MOCK REPORT TEXT (source of truth):
"""
${text}
"""

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON matching the schema.
- No markdown, no extra commentary.
- assumptions must be [] if none.
`;
}
