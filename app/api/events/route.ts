import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { EventPayloadSchema } from "@/lib/schemas/event";
import { fireAndForgetEvent } from "@/lib/events";
import { assertActiveUser } from "@/lib/users";
import { ensureSession, attachSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const authedUserId = getSessionUserId(session);

  // If not authed, create/use our anonymous cookie session
  const fallbackSession = authedUserId ? null : ensureSession(req);
  const resolvedUserId = authedUserId || fallbackSession?.userId;

  if (!resolvedUserId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Unable to resolve user session."), { status: 401 });
  }

  // Only block if the user is actually authenticated and flagged
  if (authedUserId) {
    const activeUser = await assertActiveUser(authedUserId);
    if (!activeUser || activeUser.blocked) {
      return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid JSON body."), { status: 400 });
  }

  const parsed = EventPayloadSchema.safeParse(body);
  if (!parsed.success) {
  // Don't break UX/console for analytics issues
  return NextResponse.json(ok({ success: false, ignored: true }));
}


  fireAndForgetEvent({ userId: resolvedUserId, payload: parsed.data });

  const res = NextResponse.json(ok({ success: true }));

  // If we minted a new anon session, set cookies so future calls stop being "new"
  if (fallbackSession?.isNew) {
    attachSessionCookie(res, fallbackSession);
  }

  return res;
}
