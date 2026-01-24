import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { EiBotRequestSchema } from "@/lib/schemas/bot";
import { respondWithEiTemplate } from "@/lib/bots/ei";
import { fireAndForgetEvent } from "@/lib/events";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const userId = session.user.id;
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const body = await req.json();
  const parsed = EiBotRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid bot request.", parsed.error.format()), {
      status: 400,
    });
  }

  const response = respondWithEiTemplate(parsed.data.message);
  fireAndForgetEvent({
    userId,
    payload: { eventName: "chat_with_bot", payload: { type: "ei" } },
  });

  return NextResponse.json(ok(response));
}
