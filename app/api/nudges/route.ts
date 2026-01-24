import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { buildNudges } from "@/lib/engine/nudges";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const userId = session.user.id;
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const events = db.collection(COLLECTIONS.events);
  const actions = db.collection(COLLECTIONS.actions);

  const recentEvents = await events.find({ userId }).sort({ timestamp: -1 }).limit(20).toArray();
  const lastDone = await actions.find({ userId, done: true }).sort({ completedAt: -1 }).limit(1).toArray();

  const nudges = buildNudges({
    events: recentEvents,
    lastActionDoneAt: lastDone[0]?.completedAt ?? null,
  });

  return NextResponse.json(ok(nudges));
}
