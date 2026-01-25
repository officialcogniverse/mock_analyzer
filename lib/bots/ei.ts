import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EI_MODEL = process.env.OPENAI_EI_MODEL || "gpt-4.1-mini";

const EiResponseSchema = z
  .object({
    insights: z.array(z.string().min(1)).min(1),
    controllableFactors: z.array(z.string().min(1)).min(1),
    uncontrollableFactors: z.array(z.string().min(1)).min(1),
    nextSteps: z.array(z.string().min(1)).min(1),
    frictionSignals: z.array(z.string().min(1)).default([]),
  })
  .strict();

const FALLBACK_RESPONSE = {
  insights: [
    "Noticing your emotions is a strength—use it to choose one small action today.",
    "Consistency beats intensity when confidence is shaky.",
  ],
  controllableFactors: [
    "Sleep and recovery cadence",
    "Short daily review blocks",
    "Environment setup before a mock",
  ],
  uncontrollableFactors: ["Exam-day surprises", "Past results"],
  nextSteps: [
    "Pick one action from your checklist and finish it in 20 minutes.",
    "Write down one thing you did well in the last attempt.",
  ],
  frictionSignals: [],
};

function buildSystemPrompt() {
  return [
    "You are the Cogniverse EI coach.",
    "You are not a therapist, not a medical professional, and you never diagnose.",
    "Keep guidance practical, short, and student-safe.",
    "Return strict JSON with keys: insights, controllableFactors, uncontrollableFactors, nextSteps, frictionSignals.",
    "Friction signals should be short tokens like avoidance, overwhelm, confidence_volatility, fatigue, procrastination.",
  ].join("\n");
}

function buildUserPrompt(message: string) {
  return [
    "Student message:",
    message,
    "Return only JSON. No markdown.",
  ].join("\n");
}

export async function generateEiResponse(message: string) {
  if (!process.env.OPENAI_API_KEY) {
    return FALLBACK_RESPONSE;
  }

  const response = await client.responses.create({
    model: EI_MODEL,
    input: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(message) },
    ],
    temperature: 0.2,
    max_output_tokens: 350,
  });

  const text = response.output_text?.trim();
  if (!text) {
    return FALLBACK_RESPONSE;
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return FALLBACK_RESPONSE;
  }

  const validated = EiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return FALLBACK_RESPONSE;
  }

  return validated.data;
}
