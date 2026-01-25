import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";

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
  const analyses = db.collection(COLLECTIONS.analyses);
  const attempts = db.collection(COLLECTIONS.attempts);
  const uploads = db.collection(COLLECTIONS.uploads);

  const analysis = await analyses.find({ userId }).sort({ createdAt: -1 }).limit(1).next();
  if (!analysis) {
    return NextResponse.json(ok({ analysisId: null, analysis: null, attempt: null, upload: null }));
  }

  const attemptObjectId = ObjectId.isValid(analysis.attemptId)
    ? new ObjectId(analysis.attemptId)
    : null;
  const attempt = attemptObjectId
    ? await attempts.findOne({ _id: attemptObjectId, userId })
    : null;

  const uploadObjectId = analysis.uploadId && ObjectId.isValid(analysis.uploadId)
    ? new ObjectId(analysis.uploadId)
    : null;
  const upload = uploadObjectId ? await uploads.findOne({ _id: uploadObjectId, userId }) : null;

  const analysisSafe = { ...analysis, _id: analysis._id.toString() };

  return NextResponse.json(
    ok({
      analysisId: analysis._id.toString(),
      analysis: analysisSafe,
      attempt: attempt
        ? {
            attemptId: attempt._id.toString(),
            exam: attempt.exam ?? null,
            createdAt: attempt.createdAt,
          }
        : null,
      upload: upload
        ? {
            uploadId: upload._id.toString(),
            filename: upload.filename ?? null,
            type: upload.type ?? null,
            extractedTextSnippet: upload.extractedText?.slice(0, 240) ?? null,
          }
        : null,
    })
  );
}
