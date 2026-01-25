import { NextResponse } from "next/server";
import { z } from "zod";
import { extractTextFromPdf } from "@/lib/extractText";
import { analyzeMockText } from "@/lib/engines/mvpAnalyze";
import { AnalysisResponseSchema } from "@/lib/schemas/mvp";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_RAWTEXT_LENGTH = 6000;
const MIN_EXTRACTED_TEXT = 50;
const MIN_TEXT_LENGTH = 50;

const TextInputSchema = z.object({
  text: z.string().trim().min(MIN_TEXT_LENGTH, "Text is too short."),
});

export const runtime = "nodejs";

function errorResponse(code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status: 400 });
}

async function parseRequest(req: Request): Promise<{ file: File | null; textInput: string }> {
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
    return { file, textInput };
  }

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const textInput = typeof body?.text === "string" ? body.text : "";
    return { file: null, textInput };
  }

  const textInput = await req.text().catch(() => "");
  return { file: null, textInput };
}

export async function POST(req: Request) {
  const { file, textInput } = await parseRequest(req);

  let rawText = "";

  if (file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return errorResponse("FILE_TOO_LARGE", "File exceeds 8MB limit.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      try {
        rawText = await extractTextFromPdf(buffer);
      } catch {
        return errorResponse(
          "PDF_PARSE_FAILED",
          "We couldn’t read that PDF. Try a different PDF or paste the text instead."
        );
      }

      rawText = rawText.trim();
      if (rawText.length < MIN_EXTRACTED_TEXT) {
        return errorResponse(
          "PDF_TEXT_TOO_LOW",
          "This PDF looks scanned/image-based, so we can’t extract text. Please paste the scorecard text, or upload a text-based PDF."
        );
      }
    } else if (["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return errorResponse(
        "IMAGE_OCR_UNAVAILABLE",
        "Image OCR is unavailable. Please upload a text-based PDF or paste the text."
      );
    } else {
      return errorResponse("UNSUPPORTED_FILE", "Only PDF uploads are supported for now.");
    }
  }

  if (!rawText && textInput.trim()) {
    const parsed = TextInputSchema.safeParse({ text: textInput });
    if (!parsed.success) {
      return errorResponse("INVALID_TEXT", "Please paste at least a few lines of mock scorecard text.");
    }
    rawText = parsed.data.text;
  }

  rawText = rawText.trim();
  if (!rawText) {
    return errorResponse("MISSING_INPUT", "Provide a file or paste text.");
  }

  const normalizedText = rawText.slice(0, MAX_RAWTEXT_LENGTH);
  const analysis = await analyzeMockText(normalizedText);

  const response = AnalysisResponseSchema.parse({
    ok: true,
    analysis,
  });

  return NextResponse.json(response);
}
