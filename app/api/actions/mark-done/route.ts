import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { fireAndForgetEvent } from "@/lib/events";
import { assertActiveUser } from "@/lib/users";

const BodySchema = z.object({
  analysisId: z.string().min(1),
  actionId: z.string().min(1),
  done: z.boolean(),
});

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const userId = session.user.id;
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const url = new URL(req.url);
  const analysisId = String(url.searchParams.get("analysisId") || "").trim();
  if (!analysisId) {
    return NextResponse.json(fail("INVALID_INPUT", "analysisId is required."), { status: 400 });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const actions = db.collection(COLLECTIONS.actions);

  const docs = await actions.find({ userId, analysisId }).toArray();

  return NextResponse.json(
    ok({
      items: docs.map((doc) => ({
        actionId: doc.actionId,
        done: doc.done,
        completedAt: doc.completedAt ?? null,
      })),
    })
  );
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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid payload.", mapZodError(parsed.error)), {
      status: 400,
    });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const actions = db.collection(COLLECTIONS.actions);

  const now = new Date();
  await actions.updateOne(
    { userId, analysisId: parsed.data.analysisId, actionId: parsed.data.actionId },
    {
      $set: {
        done: parsed.data.done,
        updatedAt: now,
        completedAt: parsed.data.done ? now : null,
      },
      $setOnInsert: {
        userId,
        analysisId: parsed.data.analysisId,
        actionId: parsed.data.actionId,
      },
    },
    { upsert: true }
  );

  fireAndForgetEvent({
    userId,
    payload: { eventName: "mark_action_done", payload: parsed.data },
  });

  return NextResponse.json(ok({ success: true }));
}
