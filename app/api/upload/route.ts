import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "path";
import { promises as fs } from "fs";
import { nanoid } from "nanoid";

import { authOptions, getSessionUserId } from "@/lib/auth";
import { ok, fail, mapZodError } from "@/lib/api/errors";
import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";
import { extractTextFromPdf } from "@/lib/extractText";
import { extractTextFromImages } from "@/lib/extractTextFromImages";
import { z } from "zod";
import { assertActiveUser } from "@/lib/users";

const TextSchema = z.object({
  text: z.string().min(1).optional(),
});

function buildConfidence(text: string) {
  const lengthScore = Math.min(1, text.length / 1200);
  const keywordHit = /(score|accuracy|section|attempt|percent|mock)/i.test(text) ? 0.2 : 0;
  const numericHit = /\d{2,3}%|\d{2,3}\b/.test(text) ? 0.2 : 0;
  const confidence = Math.min(1, lengthScore + keywordHit + numericHit);
  if (confidence >= 0.5) {
    return { status: "ok" as const, confidence };
  }
  return { status: "needs_intake" as const, confidence, reason: "low_extraction_signal" };
}

async function persistFile(params: { filename: string; data: Buffer }) {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const fileId = `${nanoid()}-${params.filename}`;
  const filePath = path.join(uploadsDir, fileId);
  await fs.writeFile(filePath, params.data);
  return `/uploads/${fileId}`;
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

  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(fail("INVALID_REQUEST", "Expected multipart/form-data."), { status: 400 });
    }

    const form = await req.formData();
    const textPayload = TextSchema.safeParse({ text: form.get("text")?.toString() });
    if (!textPayload.success) {
      return NextResponse.json(fail("INVALID_TEXT", "Invalid text input.", mapZodError(textPayload.error)), {
        status: 400,
      });
    }

    const file = form.get("file");
    let extractedText = "";
    let type: "pdf" | "image" | "text" = "text";
    let storageRef: string | null = null;
    let filename: string | null = null;
    let mimeType: string | null = null;
    let size: number | null = null;

    if (file && file instanceof File) {
      filename = file.name;
      mimeType = file.type;
      size = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      if (mimeType === "application/pdf") {
        type = "pdf";
        extractedText = await extractTextFromPdf(buffer);
        storageRef = await persistFile({ filename, data: buffer });
      } else if (["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
        type = "image";
        extractedText = await extractTextFromImages([{ mime: mimeType, data: buffer }]);
        storageRef = await persistFile({ filename, data: buffer });
      } else {
        return NextResponse.json(fail("UNSUPPORTED_FILE", "Only PDF or image uploads are supported."), {
          status: 400,
        });
      }
    } else if (textPayload.data.text) {
      type = "text";
      extractedText = textPayload.data.text;
    } else {
      return NextResponse.json(fail("MISSING_INPUT", "Provide a file or text input."), { status: 400 });
    }

    const extraction = buildConfidence(extractedText);
    const db = await getDb();
    await ensureIndexes(db);
    const uploads = db.collection(COLLECTIONS.uploads);

    const doc = {
      userId,
      type,
      filename,
      mimeType,
      size,
      createdAt: new Date(),
      extractedText: extractedText || null,
      extractionMeta: {
        status: extraction.status,
        confidence: extraction.confidence,
        reason: extraction.reason ?? null,
      },
      storageRef,
    };

    const result = await uploads.insertOne(doc);

    return NextResponse.json(
      ok({
        uploadId: result.insertedId.toString(),
        filename,
        type,
        extraction,
        extractedTextSnippet: extractedText.slice(0, 280),
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail("UPLOAD_FAILED", "Upload failed.", { message: error instanceof Error ? error.message : String(error) }),
      { status: 500 }
    );
  }
}
