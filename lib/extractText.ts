import pdfParse from "@cedrugs/pdf-parse";

export class PdfParseError extends Error {
  override name = "PdfParseError";

  constructor(message: string, cause?: unknown) {
    super(message);
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  } catch (error) {
    throw new PdfParseError("Failed to parse PDF text.", error);
  }
}
