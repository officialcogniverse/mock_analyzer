import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { AnalyzeTextSchema, RecommendationBundleSchema } from "@/lib/schemas/workflow";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/extractText";
import { extractTextFromImages } from "@/lib/extractTextFromImages";
import { analyzeMock } from "@/lib/engines/mockAnalysis";
import { buildInsights } from "@/lib/engines/insights";
import { buildNbas } from "@/lib/engines/nba";
import { buildPlan } from "@/lib/engines/plan";
import { loadMemorySummary, recordStrategyUsage, selectStrategy } from "@/lib/engines/memory";
import { assertActiveUser } from "@/lib/users";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_RAWTEXT_LENGTH = 6000;

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
  const userId = getSessionUserId(session);
  if (!userId) {
    return NextResponse.json(fail("UNAUTHORIZED", "Sign in required."), { status: 401 });
  }
  const activeUser = await assertActiveUser(userId);
  if (!activeUser || activeUser.blocked) {
    return NextResponse.json(fail("ACCOUNT_DELETED", "Account deleted."), { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(fail("INVALID_REQUEST", "Expected multipart/form-data."), { status: 400 });
  }

  const form = await req.formData();
  const fileEntry = form.get("file");
  const filesEntry = form.getAll("files");
  const file =
    fileEntry instanceof File
      ? fileEntry
      : filesEntry.find((entry): entry is File => entry instanceof File) ?? null;
  const textInput = form.get("text")?.toString() ?? "";

  let rawText = "";
  let sourceType: "pdf" | "image" | "text" = "text";
  let filename: string | null = null;
  let textChars = 0;
  const missingFromInput: string[] = [];
  let extractionNotes: string | undefined;

  if (file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        fail("FILE_TOO_LARGE", "File exceeds 8MB limit."),
        { status: 400 }
      );
    }
    filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.type === "application/pdf") {
      sourceType = "pdf";
      rawText = await extractTextFromPdf(buffer);
    } else if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      sourceType = "image";
      rawText = await extractTextFromImages([{ mime: file.type, data: buffer }]);
      if (!rawText) {
        missingFromInput.push("image_ocr_not_available");
        extractionNotes = "Image OCR is unavailable; ask user to paste text or upload PDF.";
      }
    } else {
      return NextResponse.json(fail("UNSUPPORTED_FILE", "Only PDF or image uploads are supported."), {
        status: 400,
      });
    }
  } else if (textInput) {
    const parsed = AnalyzeTextSchema.safeParse({ text: textInput });
    if (!parsed.success) {
      return NextResponse.json(
        fail("INVALID_TEXT", "Invalid pasted text.", mapZodError(parsed.error)),
        { status: 400 }
      );
    }
    sourceType = "text";
    rawText = parsed.data.text;
  } else {
    return NextResponse.json(fail("MISSING_INPUT", "Provide a file or paste text."), { status: 400 });
  }

  rawText = rawText.trim();
  if (!rawText) {
    return NextResponse.json(
      fail(
        "EMPTY_INPUT",
        sourceType === "image"
          ? "We couldn’t read that image. Please upload a PDF or paste the text."
          : "We couldn’t read that input. Please upload a PDF or paste the text."
      ),
      { status: 400 }
    );
  }
  textChars = rawText.length;
  const normalizedRawText = rawText.slice(0, MAX_RAWTEXT_LENGTH);

  const { attempt, exam } = analyzeMock(rawText);
  const insights = buildInsights(attempt);
  const inferred = {
    persona: insights.inferred.persona,
    riskPatterns: insights.inferred.riskPatterns,
    confidenceGap: insights.inferred.confidenceGap,
  };
  const missing = [...new Set([...attempt.missing, ...missingFromInput])];

  const db = await getDb();
  await ensureIndexes(db);

  const examLabel = exam.detected ?? "agnostic";
  const memorySummary = await loadMemorySummary(db, userId, examLabel, inferred.persona ?? "steady");
  const strategy = selectStrategy({
    exam: examLabel,
    persona: inferred.persona ?? "steady",
    avoidStrategies: memorySummary.avoidStrategies,
  });

  const nbas = buildNbas({
    attempt: { ...attempt, inferred, missing },
    strategy,
  });
  const plan = buildPlan(nbas, strategy.horizonDays);

  const recommendation = RecommendationBundleSchema.parse({
    insights: { ...insights, inferred, missing },
    nbas,
    plan,
    strategy: { id: strategy.id, exam: strategy.exam, persona: strategy.persona },
  });

  const attempts = db.collection(COLLECTIONS.attempts);
  const recommendations = db.collection(COLLECTIONS.recommendations);

  const attemptDoc = {
    userId,
    createdAt: new Date(),
    source: {
      type: sourceType,
      filename,
      textChars,
    },
    exam,
    rawText: normalizedRawText,
    rawTextHash: hashText(rawText),
    known: attempt.known,
    inferred,
    missing,
    artifacts: {
      extractionQuality: attempt.artifacts.extractionQuality,
      notes: extractionNotes,
    },
  };
  const attemptResult = await attempts.insertOne(attemptDoc);

  const recommendationDoc = {
    userId,
    attemptId: attemptResult.insertedId.toString(),
    createdAt: new Date(),
    insights: recommendation.insights,
    nbas: recommendation.nbas,
    plan: recommendation.plan,
    strategy: recommendation.strategy,
  };
  const recommendationResult = await recommendations.insertOne(recommendationDoc);

  await recordStrategyUsage(db, userId, strategy);

  return NextResponse.json(
    ok({
      id: attemptResult.insertedId.toString(),
      recommendationId: recommendationResult.insertedId.toString(),
      attempt: { ...attemptDoc, _id: attemptResult.insertedId.toString() },
      recommendation: {
        ...recommendationDoc,
        _id: recommendationResult.insertedId.toString(),
      },
      progressSummary: {
        completionRate: 0,
        tasksDone: 0,
        tasksTotal: recommendation.plan.days.reduce((sum, day) => sum + day.tasks.length, 0),
        difficultCount: 0,
        skippedCount: 0,
        topBlockers: [],
      },
      recentEvents: [],
    })
  );
}
