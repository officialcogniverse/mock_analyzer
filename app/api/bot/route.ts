import { NextResponse } from "next/server";
import { z } from "zod";
import { BotResponseSchema, createDefaultBotResponse } from "@/lib/contracts";
import { respondBot } from "@/lib/engine";
import { getOrCreateUserId } from "@/lib/state/user";
import { getUserState } from "@/lib/state/persistence";

export const runtime = "nodejs";

const BotRequestSchema = z
  .object({
    message: z.string().trim().min(1),
  })
  .strict();

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = BotRequestSchema.safeParse(payload);
  const userId = getOrCreateUserId();
  const state = await getUserState(userId);
  const fallback = createDefaultBotResponse({
    userId: state.userId,
    version: state.version,
    signals: state.signals,
    facts: state.facts,
    lastUpdated: state.updatedAt,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ...fallback, ok: false, error: { code: "INVALID_BOT", message: "Message required." } },
      { status: 400 }
    );
  }

  try {
    const response = await respondBot({ userId, message: parsed.data.message });

    const normalized = BotResponseSchema.parse({
      ...response,
      stateSnapshot: {
        userId: response.stateSnapshot.userId,
        version: response.stateSnapshot.version,
        signals: response.stateSnapshot.signals,
        facts: response.stateSnapshot.facts,
        lastUpdated: response.stateSnapshot.lastUpdated,
      },
    });

    return NextResponse.json(normalized);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "OPENAI_KEY_MISSING"
        ? "OpenAI API key is missing. Add OPENAI_API_KEY to use the bot."
        : "The bot is having trouble right now. Please try again soon.";

    return NextResponse.json(
      { ...fallback, ok: false, error: { code: "BOT_UNAVAILABLE", message } },
      { status: 500 }
    );
  }
}
