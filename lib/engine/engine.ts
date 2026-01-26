import { callOpenAiChat } from "@/lib/ai/openai";
import { buildAnalysisPrompt, buildFollowupPrompt } from "@/lib/engine/prompts";
import {
  buildMissingInputs,
  ChatResponseSchema,
  normalizeAnalysisResult,
  type AnalysisResult,
  type ChatMode,
  type ChatResponse,
  type IntakeAnswers,
} from "@/lib/engine/schemas";

type AnalysisRunInput = {
  intake?: IntakeAnswers;
  text: string;
  horizonDays?: 7 | 14;
};

type FollowupInput = {
  mode: ChatMode;
  message: string;
  intake?: IntakeAnswers;
  analysis?: AnalysisResult;
};

type LlmOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function extractJsonBlock(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return raw.slice(start, end + 1);
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function callLlm(system: string, user: string, options: LlmOptions = {}) {
  return callOpenAiChat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    {
      model: options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 1500,
    }
  );
}

export async function runAnalysis(input: AnalysisRunInput): Promise<AnalysisResult> {
  const horizonDays = input.horizonDays ?? 7;
  const missingInputs = buildMissingInputs(input.intake);
  const prompt = buildAnalysisPrompt(input.intake, input.text, horizonDays, missingInputs);
  const raw = await callLlm(
    "You are a precise JSON generator for mock analysis.",
    prompt,
    { temperature: 0.25, maxTokens: 1700 }
  );

  const extracted = extractJsonBlock(raw);
  const parsed = safeJsonParse(raw) ?? (extracted ? safeJsonParse(extracted) : null);

  return normalizeAnalysisResult(parsed ?? raw, { horizonDays, missingInputs });
}

export async function runFollowup(input: FollowupInput): Promise<ChatResponse> {
  const prompt = buildFollowupPrompt(input.mode, input.message, input.intake, input.analysis);
  const raw = await callLlm(
    "You are a helpful study coach returning strict JSON.",
    prompt,
    { temperature: 0.35, maxTokens: 700 }
  );

  const extracted = extractJsonBlock(raw);
  const parsed = safeJsonParse(raw) ?? (extracted ? safeJsonParse(extracted) : null);

  const result = ChatResponseSchema.safeParse(parsed);
  if (result.success) {
    return result.data;
  }

  return {
    mode: input.mode,
    reply:
      "I’m here with you. Let’s focus on one improvement for the next 48 hours, then stack consistency.",
    suggestedChips: ["Summarize my top errors", "Give me a 2-day plan", "Reset my routine"],
    disclaimer:
      input.mode === "MOTIVATION"
        ? "Supportive guidance only — not medical or therapeutic advice."
        : undefined,
  };
}
