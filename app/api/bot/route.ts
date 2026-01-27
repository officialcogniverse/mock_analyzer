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
  const userId = await getOrCreateUserId();
  const state = await getUserState(userId);
  const fallback = createDefaultBotResponse({
    userId: state.userId,
    version: state.version,
    signals: state.signals,
    facts: state.facts,
    lastUpdated: state.updatedAt,

  // Make fallback safe even if state fails
  let userId = "anon";
  let fallback = createDefaultBotResponse({
    userId,
    version: 1,
    signals: {},
    facts: {},
    lastUpdated: new Date().toISOString(),
  });

  try {
    userId = await getOrCreateUserId();
    const state = await getUserState(userId);
    fallback = createDefaultBotResponse({
      userId: state.userId,
      version: state.version,
      signals: state.signals,
      facts: state.facts,
      lastUpdated: state.updatedAt,
    });
  } catch (e) {
    console.error("[api/bot] state bootstrap failed:", e);
    // continue with safe fallback
  }

  if (!parsed.success) {
    return NextResponse.json(
      { ...fallback, ok: false, error: { code: "INVALID_BOT", message: "Message required." } },
      { status: 200 } // IMPORTANT: keep UI stable
    );
  }

    try {
    const response = await respondBot({ userId, message: parsed.data.message });

    // Normalize directives: some engines return string[]; contract expects object[]
    const safeDirectives = Array.isArray((response as any)?.directives)
      ? (response as any).directives
          .filter(Boolean)
          .map((d: any) => (typeof d === "string" ? { type: "note", text: d } : d))
      : [];

    const normalized = BotResponseSchema.safeParse({
      ...response,
      directives: safeDirectives,
      stateSnapshot: (response as any)?.stateSnapshot
        ? {
            userId: (response as any).stateSnapshot.userId ?? fallback.stateSnapshot.userId,
            version: (response as any).stateSnapshot.version ?? fallback.stateSnapshot.version,
            signals: (response as any).stateSnapshot.signals ?? fallback.stateSnapshot.signals,
            facts: (response as any).stateSnapshot.facts ?? fallback.stateSnapshot.facts,
            lastUpdated:
              (response as any).stateSnapshot.lastUpdated ?? fallback.stateSnapshot.lastUpdated,
          }
        : fallback.stateSnapshot,
    });

    if (!normalized.success) {
      console.error("[api/bot] schema mismatch:", normalized.error);
      return NextResponse.json(
        {
          ...fallback,
          ok: false,
          error: {
            code: "BOT_SCHEMA",
            message: "Bot response was invalid. Fix respondBot contract.",
          },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(normalized.data, { status: 200 });
  } catch (error) {

    console.error("[api/bot] respondBot failed:", error);

    const msg = error instanceof Error ? error.message : String(error);

    const message =
      msg.includes("OPENAI") || msg.includes("api key") || msg.includes("API_KEY")
        ? "OpenAI configuration is missing or invalid. Set OPENAI_API_KEY and restart."
        : "The bot is having trouble right now. Please try again soon.";

    return NextResponse.json(
      { ...fallback, ok: false, error: { code: "BOT_UNAVAILABLE", message, debug: process.env.NODE_ENV === "development" ? msg : undefined } },
      { status: 200 } // IMPORTANT: do NOT 500 the UI
    );
  }
}

