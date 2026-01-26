import { NextResponse } from "next/server";
import { ChatRequestSchema } from "@/lib/engine/schemas";
import { runFollowup } from "@/lib/engine/engine";

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

  try {
    const response = await runFollowup(parsed.data);

    return NextResponse.json({ ok: true, response });
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
