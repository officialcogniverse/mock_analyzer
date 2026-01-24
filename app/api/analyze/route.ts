import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ObjectId } from "mongodb";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { detectExamFromText } from "@/lib/examDetect";
import { normalizeSignals, rankActions, buildPlan } from "@/lib/engine/signals";
import { assertActiveUser } from "@/lib/users";

const BodySchema = z.object({
  uploadId: z.string().min(1),
  intake: z
    .object({
      examGoal: z.string().optional(),
      weeklyHours: z.number().optional(),
      baselineLevel: z.string().optional(),
    })
    .optional(),
});

function summarizeIntake(intake?: Record<string, any>) {
  if (!intake) return "";
  return Object.entries(intake)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

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
    return NextResponse.json(
      fail("INVALID_INPUT", "Invalid analyze payload.", mapZodError(parsed.error)),
      { status: 400 }
    );
  }

  const db = await getDb();
  await ensureIndexes(db);
  const uploads = db.collection(COLLECTIONS.uploads);
  const attempts = db.collection(COLLECTIONS.attempts);
  const analyses = db.collection(COLLECTIONS.analyses);

  const upload = await uploads.findOne({
    _id: new ObjectId(parsed.data.uploadId),
    userId,
  });

  if (!upload) {
    return NextResponse.json(fail("NOT_FOUND", "Upload not found."), { status: 404 });
  }

  const sourceText = upload.extractedText || summarizeIntake(parsed.data.intake ?? {}) || "";
  const exam = detectExamFromText(sourceText) ?? activeUser.examGoal ?? "General";
  const attemptDoc = {
    userId,
    uploadId: parsed.data.uploadId,
    createdAt: new Date(),
    exam,
    rawTextHash: hashText(sourceText),
  };
  const attemptResult = await attempts.insertOne(attemptDoc);

  const signals = normalizeSignals({
    profile: {
      examGoal: activeUser.examGoal,
      weeklyHours: activeUser.weeklyHours,
      baselineLevel: activeUser.baselineLevel,
    },
    performance: {},
    events: {},
    textHints: sourceText.split(/\s+/).slice(0, 24),
  });

  const nba = rankActions(signals);
  const plan = buildPlan(signals);

  const analysisDoc = {
    userId,
    attemptId: attemptResult.insertedId.toString(),
    uploadId: parsed.data.uploadId,
    createdAt: new Date(),
    summary: `Plan built for ${signals.examGoal} with ${signals.paceBand} weekly capacity.`,
    nba,
    plan,
    signalsUsed: signals,
    warnings: sourceText ? [] : ["Missing extracted text; used intake summary instead."],
  };

  const analysisResult = await analyses.insertOne(analysisDoc);

  return NextResponse.json(
    ok({
      attemptId: analysisDoc.attemptId,
      analysisId: analysisResult.insertedId.toString(),
      analysis: analysisDoc,
    })
  );
}
