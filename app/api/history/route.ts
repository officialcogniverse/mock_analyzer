import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

import { authOptions } from "@/lib/auth";
import { ok, fail } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
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
  const attempts = db.collection(COLLECTIONS.attempts);
  const analyses = db.collection(COLLECTIONS.analyses);
  const uploads = db.collection(COLLECTIONS.uploads);
  const actions = db.collection(COLLECTIONS.actions);

  const attemptDocs = await attempts
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  const attemptIds = attemptDocs.map((attempt) => attempt._id.toString());
  const analysisDocs = await analyses
    .find({ userId, attemptId: { $in: attemptIds } })
    .toArray();

  const uploadIds = attemptDocs.map((attempt) => new ObjectId(attempt.uploadId));
  const uploadDocs = await uploads
    .find({ userId, _id: { $in: uploadIds } })
    .toArray();

  const actionDocs = await actions
    .find({ userId, analysisId: { $in: analysisDocs.map((analysis) => analysis._id.toString()) } })
    .toArray();

  const history = attemptDocs.map((attempt) => {
    const analysis = analysisDocs.find((item) => item.attemptId === attempt._id.toString());
    const upload = uploadDocs.find((item) => item._id.toString() === attempt.uploadId);
    const completed = actionDocs.filter(
      (action) => action.analysisId === analysis?._id.toString() && action.done
    ).length;
    const total = analysis?.nba?.length ?? 0;

    return {
      attemptId: attempt._id.toString(),
      analysisId: analysis?._id.toString() ?? null,
      createdAt: attempt.createdAt,
      exam: attempt.exam ?? null,
      uploadType: upload?.type ?? null,
      nbaTitles: analysis?.nba?.slice(0, 2).map((action: any) => action.title) ?? [],
      completion: { completed, total },
    };
  });

  return NextResponse.json(ok(history));
}
