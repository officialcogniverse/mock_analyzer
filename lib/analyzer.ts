import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ReportSchema, type Report } from "./schema";
import { buildPrompt } from "./prompts";
import type { AnalyzeInput } from "./types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeMock(input: AnalyzeInput): Promise<Report> {
  const prompt = buildPrompt(input);

  const response = await client.responses.parse({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: "You are Cogniverse Mock Analyzer. Always follow the output schema strictly." },
      { role: "user", content: prompt },
    ],
    text: {
      format: zodTextFormat(ReportSchema, "mock_report"),
    },
  });

  if (!response.output_parsed) {
    const raw = response.output_text?.slice(0, 800);
    throw new Error(`Model did not return parsed JSON. Raw: ${raw ?? "EMPTY"}`);
  }

  return response.output_parsed;
}
