import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { assertActiveUser } from "@/lib/users";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser) {
    return NextResponse.json(fail("NOT_FOUND", "Account not found."), { status: 404 });
  }
  if (activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const users = db.collection(COLLECTIONS.users);

  await users.updateOne(
    { userId },
    {
      $set: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json(ok({ success: true }));
}
