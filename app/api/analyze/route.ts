import { NextResponse } from "next/server";
import { z } from "zod";
import { extractTextFromPdf } from "@/lib/extractText";
import { analyzeMockAndPlan } from "@/lib/engine";
import { AnalyzeRequestSchema, IntakeAnswersSchema } from "@/lib/engine/schemas";
import {
  AnalyzeResponseSchema,
  createDefaultAnalyzeResponse,
} from "@/lib/contracts";
import { getOrCreateUserId } from "@/lib/state/user";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_RAWTEXT_LENGTH = 8000;
const MIN_EXTRACTED_TEXT = 120;
const MIN_TEXT_LENGTH = 200;

const TextInputSchema = z.object({
  text: z.string().trim().min(MIN_TEXT_LENGTH, "Text is too short."),
});

export const runtime = "nodejs";

function errorResponse(
  code: string,
  message: string,
  status = 400,
  fallback?: ReturnType<typeof createDefaultAnalyzeResponse>
) {
  const response = AnalyzeResponseSchema.parse({
    ...(fallback ?? createDefaultAnalyzeResponse()),
    ok: false,
    error: { code, message },
  });
  return NextResponse.json(response, { status });
}

async function parseRequest(req: Request): Promise<{
  file: File | null;
  textInput: string;
  intakeInput?: unknown;
  horizonDays?: string;
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const fileEntry = form.get("file");
    const filesEntry = form.getAll("files");

    const file =
      fileEntry instanceof File
        ? fileEntry
        : filesEntry.find((entry): entry is File => entry instanceof File) ?? null;

    const textInput = form.get("text")?.toString() ?? "";
    const intakeInput = form.get("intake")?.toString();
    const horizonDays = form.get("horizonDays")?.toString();
    return { file, textInput, intakeInput, horizonDays };
  }

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const textInput = typeof body?.text === "string" ? body.text : "";
    const intakeInput = body?.intake ?? undefined;
    const horizonDays =
      typeof body?.horizonDays === "string"
        ? body.horizonDays
        : typeof body?.horizonDays === "number"
          ? String(body.horizonDays)
          : undefined;
    return { file: null, textInput, intakeInput, horizonDays };
  }

  const textInput = await req.text().catch(() => "");
  return { file: null, textInput };
}

export async function POST(req: Request) {
  const userId = getOrCreateUserId();
  const { file, textInput, intakeInput, horizonDays } = await parseRequest(req);

  let rawText = "";
  let scannedPdf = false;
  let extractedChars = 0;
  const resolveFallback = () =>
    createDefaultAnalyzeResponse({
      source: file ? "pdf" : "text",
      horizonDays: horizonDays === "14" ? 14 : 7,
      scannedPdf,
      extractedChars,
    });

  if (file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "File exceeds 8MB limit.", 400, resolveFallback());
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      try {
        rawText = await extractTextFromPdf(buffer);
      } catch {
        return errorResponse(
          "PDF_PARSE_FAILED",
          "We couldn’t read that PDF. Try a different PDF or paste the text instead.",
          400,
          resolveFallback()
        );
      }

      rawText = rawText.trim();
      extractedChars = rawText.length;
      if (rawText.length < MIN_EXTRACTED_TEXT) {
        scannedPdf = true;
        return errorResponse(
          "SCANNED_PDF",
          "Scanned PDFs aren’t supported yet. Try exporting a text-based PDF or paste the scorecard text.",
          400,
          resolveFallback()
        );
      }
    } else if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return errorResponse(
        "IMAGE_OCR_UNAVAILABLE",
        "Image OCR is unavailable. Please upload a text-based PDF or paste the text.",
        400,
        resolveFallback()
      );
    } else {
      return errorResponse("UNSUPPORTED_FILE", "Only PDF uploads are supported for now.", 400, resolveFallback());
    }
  }

  if (rawText && rawText.length < MIN_TEXT_LENGTH) {
    return errorResponse(
      "INVALID_TEXT",
      "We need a bit more text to analyze. Please paste more detail or upload a fuller scorecard.",
      400,
      resolveFallback()
    );
  }

  if (!rawText && textInput.trim()) {
    const parsed = TextInputSchema.safeParse({ text: textInput });
    if (!parsed.success) {
      return errorResponse(
        "INVALID_TEXT",
        "Please paste at least a few lines of mock scorecard text (200+ characters).",
        400,
        resolveFallback()
      );
    }
    rawText = parsed.data.text;
  }

  rawText = rawText.trim();
  if (!extractedChars) {
    extractedChars = rawText.length;
  }
  if (!rawText) {
    return errorResponse("MISSING_INPUT", "Provide a file or paste text.", 400, resolveFallback());
  }

  const normalizedText = rawText.slice(0, MAX_RAWTEXT_LENGTH);
  let intakePayload: unknown | null = null;
  if (intakeInput) {
    if (typeof intakeInput === "string") {
      try {
        intakePayload = JSON.parse(intakeInput);
      } catch {
        intakePayload = null;
      }
    } else {
      intakePayload = intakeInput;
    }
  }
  const intakeParsed = intakePayload ? IntakeAnswersSchema.safeParse(intakePayload) : null;
  const parsedHorizon =
    horizonDays === "14" ? 14 : horizonDays === "7" ? 7 : undefined;

  const requestPayload = AnalyzeRequestSchema.safeParse({
    intake: intakeParsed?.success ? intakeParsed.data : undefined,
    source: file ? "pdf" : "text",
    text: normalizedText,
    horizonDays: parsedHorizon,
  });

  if (!requestPayload.success) {
    return errorResponse("INVALID_REQUEST", "Please check your inputs and try again.", 400, resolveFallback());
  }

  try {
    const result = await analyzeMockAndPlan({
      userId,
      intake: requestPayload.data.intake,
      text: requestPayload.data.text,
      horizonDays: requestPayload.data.horizonDays,
      source: requestPayload.data.source,
      scannedPdf,
      extractedChars,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "OPENAI_KEY_MISSING"
        ? "OpenAI API key is missing. Add OPENAI_API_KEY to use analysis."
        : "We hit a snag generating the report. Please try again in a moment.";

    return errorResponse("ANALYZE_FAILED", message, 500, resolveFallback());
  }
}
