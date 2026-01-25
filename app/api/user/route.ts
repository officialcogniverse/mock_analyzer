import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { ThemeSchema } from "@/lib/schemas/userProfile";
import { assertActiveUser } from "@/lib/users";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { upsertUser } from "@/lib/persist";

const UpdateSchema = z.object({
  displayName: z.string().optional().nullable(),
  examGoal: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  weeklyHours: z.number().optional().nullable(),
  baselineLevel: z.string().optional().nullable(),
  onboardingCompleted: z.boolean().optional(),
  preferences: z
    .object({
      theme: ThemeSchema,
    })
    .optional(),
});

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  const fallbackSession = userId ? null : ensureSession(req);
  const resolvedUserId = userId || fallbackSession?.userId;
  if (!resolvedUserId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }

  await upsertUser(resolvedUserId);
  const activeUser = await assertActiveUser(resolvedUserId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const res = NextResponse.json(ok(activeUser));
  if (fallbackSession?.isNew) {
    attachSessionCookie(res, fallbackSession);
  }
  return res;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = getSessionUserId(session);
  const fallbackSession = userId ? null : ensureSession(req);
  const resolvedUserId = userId || fallbackSession?.userId;
  if (!resolvedUserId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }

  await upsertUser(resolvedUserId);
  const activeUser = await assertActiveUser(resolvedUserId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid profile update.", mapZodError(parsed.error)), {
      status: 400,
    });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const users = db.collection<any>(COLLECTIONS.users);

  const patch = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  await users.updateOne(
    { $or: [{ userId: resolvedUserId }, { _id: resolvedUserId }] },
    { $set: { ...patch, userId: resolvedUserId } }
  );
  const updated = await users.findOne({
    $or: [{ userId: resolvedUserId }, { _id: resolvedUserId }],
  });

  const res = NextResponse.json(ok(updated));
  if (fallbackSession?.isNew) {
    attachSessionCookie(res, fallbackSession);
  }
  return res;
}
