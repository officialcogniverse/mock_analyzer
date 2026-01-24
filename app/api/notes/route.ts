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
  content: z.string().min(1),
});

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
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("INVALID_INPUT", "Invalid payload.", mapZodError(parsed.error)), {
      status: 400,
    });
  }

  const db = await getDb();
  await ensureIndexes(db);
  const notes = db.collection(COLLECTIONS.notes);

  const doc = {
    userId,
    analysisId: parsed.data.analysisId,
    actionId: parsed.data.actionId,
    content: parsed.data.content,
    createdAt: new Date(),
  };

  const result = await notes.insertOne(doc);

  fireAndForgetEvent({
    userId,
    payload: { eventName: "create_note", payload: parsed.data },
  });

  return NextResponse.json(ok({ noteId: result.insertedId.toString() }));
}
