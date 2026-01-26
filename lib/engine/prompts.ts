import type { AnalysisResult, ChatMode, IntakeAnswers } from "@/lib/engine/schemas";

const ANALYSIS_SCHEMA_REFERENCE = `{
  "summary": "string",
  "topErrors": [
    {
      "title": "string",
      "whyItHappens": "string",
      "fix": "string",
      "severity": 1
    }
  ],
  "nextBestActions": [
    {
      "title": "string",
      "reason": "string",
      "timeMinutes": 20,
      "difficulty": 1,
      "priority": "P1",
      "checklist": ["string"]
    }
  ],
  "plan": {
    "horizonDays": 7,
    "days": [
      {
        "day": 1,
        "focus": "string",
        "tasks": [
          {
            "title": "string",
            "minutes": 30,
            "method": "string",
            "expectedOutcome": "string"
          }
        ]
      }
    ]
  },
  "motivation": {
    "currentStateLabel": "string",
    "microPepTalk": "string",
    "routineAdvice": "string",
    "environmentTweaks": ["string"]
  },
  "confidence": {
    "dataQuality": "low",
    "missingInputs": ["string"]
  }
}`;

function formatIntake(intake?: IntakeAnswers) {
  if (!intake) return "No intake provided.";
  return JSON.stringify(intake, null, 2);
}

export function buildAnalysisPrompt(
  intake: IntakeAnswers | undefined,
  mockText: string,
  horizonDays: 7 | 14,
  missingInputs: string[]
) {
  return `You are Cogniverse Mock Analyzer. Produce a clean, concise mock analysis for a student.
Return STRICT JSON ONLY. No markdown. Do not include null values. Use reasonable defaults when unsure.
Required output must exactly match this schema:
${ANALYSIS_SCHEMA_REFERENCE}

Constraints:
- Summary: 2-4 sentences.
- TopErrors: at least 3 items.
- NextBestActions: 5-9 items with checklist steps (>=1).
- Study plan: ${horizonDays} days, 3-6 tasks per day, each task 15-60 minutes.
- Motivation: practical, non-therapy, supportive.
- Confidence.missingInputs: list any missing intake fields.

Missing intake fields (computed): ${missingInputs.length ? missingInputs.join(", ") : "none"}
Intake answers:
${formatIntake(intake)}

Mock scorecard text:
${mockText}
`;
}

export function buildFollowupPrompt(
  mode: ChatMode,
  message: string,
  intake?: IntakeAnswers,
  analysis?: AnalysisResult
) {
  return `You are Cogniverse Strategy Companion. Reply in STRICT JSON ONLY, no markdown.
Use the schema: { "mode": "${mode}", "reply": "string", "suggestedChips": ["string"], "disclaimer": "string" }
Rules:
- reply must be concise (90-160 words), actionable, and aligned to the mode.
- suggestedChips: provide 2-4 short options when helpful.
- Do not output null values. Use empty arrays only if necessary.
- Only include disclaimer for MOTIVATION mode. Keep it short and non-therapeutic.

Context intake:
${formatIntake(intake)}

Latest analysis summary:
${analysis ? JSON.stringify(analysis, null, 2) : "No analysis yet."}

User message:
${message}
`;
}
