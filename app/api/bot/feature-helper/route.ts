import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { BotMessageSchema } from "@/lib/schemas/bot";
import { respondWithFeatureCatalog } from "@/lib/bots/featureHelper";
import { fireAndForgetEvent } from "@/lib/events";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const body = await req.json();
  const parsed = BotMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid bot request.", parsed.error.format()), {
      status: 400,
    });
  }

  const reply = respondWithFeatureCatalog(parsed.data.message);
  const matches = reply.matches.map(({ score, ...rest }) => rest);
  fireAndForgetEvent({
    userId,
    payload: { eventName: "chat_with_bot", payload: { mode: "feature", length: parsed.data.message.length } },
  });

  return NextResponse.json(
    ok({
      reply: reply.reply,
      matches,
      suggestions: reply.suggestions,
    })
  );
}
