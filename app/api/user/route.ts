import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { ThemeSchema } from "@/lib/schemas/userProfile";
import { assertActiveUser } from "@/lib/users";

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

  return NextResponse.json(ok(activeUser));
}

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
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid profile update.", mapZodError(parsed.error)), {
      status: 400,
    });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const users = db.collection(COLLECTIONS.users);

  const patch = {
    ...parsed.data,
    updatedAt: new Date(),
  };

  await users.updateOne({ userId }, { $set: patch });
  const updated = await users.findOne({ userId });

  return NextResponse.json(ok(updated));
}
