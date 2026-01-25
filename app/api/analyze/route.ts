import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, mapZodError } from "@/lib/api/errors";
import { AnalyzeTextSchema, RecommendationBundleSchema } from "@/lib/schemas/workflow";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/extractText";
import { analyzeMock } from "@/lib/engines/mockAnalysis";
import { buildInsights } from "@/lib/engines/insights";
import { buildNbas } from "@/lib/engines/nba";
import { buildPlan } from "@/lib/engines/plan";
import { loadMemorySummary, recordStrategyUsage, selectStrategy } from "@/lib/engines/memory";
import { buildProbes } from "@/lib/engines/probes";
import { buildNextMockStrategy } from "@/lib/engines/nextMockStrategy";
import { attachSessionCookie, ensureSession } from "@/lib/session";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_RAWTEXT_LENGTH = 6000;

const IntakeSchema = z.object({
  goal: z.enum(["score", "accuracy", "speed", "concepts"]),
  hardest: z.enum(["selection", "time", "concepts", "careless", "anxiety", "consistency"]),
  weekly_hours: z.enum(["<10", "10-20", "20-35", "35+"]),
  next_mock_date: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  preferred_topics: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

export const runtime = "nodejs";

function isPdfParseXrefError(err: unknown) {
  const error = err instanceof Error ? err : null;
  const cause = error && "cause" in error ? (error as { cause?: unknown }).cause : null;
  const msg =
    (
      (cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "") ||
      error?.message ||
      (typeof err === "string" ? err : "")
    )?.toString() || "";
  // pdf.js / pdf-parse commonly emits these
  return (
    msg.toLowerCase().includes("bad xref") ||
    msg.toLowerCase().includes("xref") ||
    msg.toLowerCase().includes("formaterror")
  );
}

export async function POST(req: Request) {
  const session = ensureSession(req);
  const userId = session.userId;

  // --- Input validation ---
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
  const intakeInput = form.get("intake")?.toString() ?? "";

  const intakeParsed = IntakeSchema.safeParse(
    intakeInput
      ? (() => {
          try {
            return JSON.parse(intakeInput);
          } catch {
            return null;
          }
        })()
      : null
  );

  if (!intakeParsed.success) {
    return NextResponse.json(
      fail(
        "INVALID_INTAKE",
        "Invalid intake payload.",
        intakeParsed.error ? mapZodError(intakeParsed.error) : undefined
      ),
      { status: 400 }
    );
  }
  const intake = intakeParsed.data;

  // --- Extract text ---
  let rawText = "";
  let sourceType: "pdf" | "image" | "text" = "text";
  let filename: string | null = null;
  let textChars = 0;
  let extractionNotes: string | undefined;

  if (file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(fail("FILE_TOO_LARGE", "File exceeds 8MB limit."), { status: 400 });
    }

    filename = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      sourceType = "pdf";
      try {
        rawText = await extractTextFromPdf(buffer);
      } catch (err) {
        // IMPORTANT: do not 500 on bad PDFs; return actionable 400
        const xref = isPdfParseXrefError(err);
        extractionNotes = xref
          ? "PDF parsing failed (bad cross-reference table). This can happen with certain generated/scanned PDFs."
          : "PDF parsing failed.";
        return NextResponse.json(
          fail(
            "PDF_PARSE_FAILED",
            xref
              ? "This PDF can’t be read (corrupted/unsupported structure). Try exporting it again, uploading a different PDF, or paste the text instead."
              : "We couldn’t read that PDF. Try a different PDF or paste the text."
          ),
          { status: 400 }
        );
      }
    } else if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      sourceType = "image";
      extractionNotes = "Image OCR is unavailable; ask user to paste text or upload PDF.";
      return NextResponse.json(
        fail("IMAGE_OCR_UNAVAILABLE", "Image OCR is unavailable. Please upload a PDF or paste the text."),
        { status: 400 }
      );
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

  // --- Run Node engines ---
  const { attempt, exam } = analyzeMock(rawText);
  const insights = buildInsights(attempt);

  const inferred = {
    persona: insights.inferred.persona,
    riskPatterns: insights.inferred.riskPatterns,
    confidenceGap: insights.inferred.confidenceGap,
  };

  const missing = [...new Set([...attempt.missing])];

  const db = await getDb();
  await ensureIndexes(db);

  // --- Memory + strategy selection ---
  const examLabel = exam.detected ?? "agnostic";
  const memorySummary = await loadMemorySummary(
    db,
    userId,
    examLabel,
    inferred.persona ?? "steady"
  );

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
  const probes = buildProbes({ ...attempt, inferred, missing });
  const nextMockStrategy = buildNextMockStrategy({ ...attempt, inferred, missing });

  const recommendation = RecommendationBundleSchema.parse({
    insights: { ...insights, inferred, missing },
    nbas,
    plan,
    probes,
    nextMockStrategy,
    strategy: { id: strategy.id, exam: strategy.exam, persona: strategy.persona },
  });

  // --- Persist ---
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
    intake,
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
    probes: recommendation.probes,
    nextMockStrategy: recommendation.nextMockStrategy,
    strategy: recommendation.strategy,
  };

  const recommendationResult = await recommendations.insertOne(recommendationDoc);

  await recordStrategyUsage(db, userId, strategy);

  // --- Response ---
  const res = NextResponse.json({
    ok: true,
    id: attemptResult.insertedId.toString(),
    recommendationId: recommendationResult.insertedId.toString(),
    attempt: {
      ...attemptDoc,
      _id: attemptResult.insertedId.toString(),
      createdAt: attemptDoc.createdAt.toISOString(),
    },
    recommendation: {
      ...recommendationDoc,
      _id: recommendationResult.insertedId.toString(),
      createdAt: recommendationDoc.createdAt.toISOString(),
    },
  });

  if (session.isNew) {
    attachSessionCookie(res, session);
  }

  return res;
}
