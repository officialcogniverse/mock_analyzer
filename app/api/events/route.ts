import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { EventPayloadSchema } from "@/lib/schemas/event";
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
  const parsed = EventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid event payload.", parsed.error.format()), {
      status: 400,
    });
  }

  fireAndForgetEvent({ userId, payload: parsed.data });
  return NextResponse.json(ok({ success: true }));
}
