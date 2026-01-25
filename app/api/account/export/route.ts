import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const users = db.collection(COLLECTIONS.users);
  const uploads = db.collection(COLLECTIONS.uploads);
  const attempts = db.collection(COLLECTIONS.attempts);
  const analyses = db.collection(COLLECTIONS.analyses);
  const actions = db.collection(COLLECTIONS.actions);
  const notes = db.collection(COLLECTIONS.notes);

  const data = {
    user: await users.findOne({ userId }),
    uploads: await uploads.find({ userId }).toArray(),
    attempts: await attempts.find({ userId }).toArray(),
    analyses: await analyses.find({ userId }).toArray(),
    actions: await actions.find({ userId }).toArray(),
    notes: await notes.find({ userId }).toArray(),
  };

  return NextResponse.json(ok(data));
}
