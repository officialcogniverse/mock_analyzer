import { NextResponse } from "next/server";
import { z } from "zod";
import { callOpenAiChat } from "@/lib/ai/openai";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1),
});

const CHAT_SYSTEM_PROMPT = `You are the Motivation + Strategy Bot for students using mock exams.
Be supportive, optimistic, and action-focused. Avoid medical or therapy advice.
Ask at most 1-2 clarifying questions if needed, then give 3-5 concrete next steps.
Keep replies under 160 words.`;

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CHAT", message: "Invalid chat payload." } },
      { status: 400 }
    );
  }

  const cleanedMessages = parsed.data.messages.filter((message) => message.role !== "system");

  try {
    const reply = await callOpenAiChat([
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...cleanedMessages,
    ]);

    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "OPENAI_KEY_MISSING"
        ? "OpenAI API key is missing. Add OPENAI_API_KEY to use the bot."
        : "The bot is having trouble right now. Please try again in a moment.";

    return NextResponse.json(
      { ok: false, error: { code: "CHAT_UNAVAILABLE", message } },
      { status: 500 }
    );
  }
}
