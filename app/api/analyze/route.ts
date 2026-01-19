import { NextResponse } from "next/server";
import { analyzeMock } from "@/lib/analyzer";
import { extractTextFromPdf } from "@/lib/extractText";
import { detectExamFromText } from "@/lib/examDetect";
import type { Exam, Intake } from "@/lib/types";
import { upsertUser, saveAttempt } from "@/lib/persist";
import { analyzeViaPython } from "@/lib/pythonClient";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";
import { z } from "zod";

const intakeSchema = z
  .object({
    goal: z.enum(["score", "accuracy", "speed", "concepts"]),
    hardest: z.enum(["selection", "time", "concepts", "careless", "anxiety"]),
    weekly_hours: z.enum(["<10", "10-20", "20-35", "35+"]),
    section: z.string().optional(),
  })
  .strict();

function normalizeExam(exam?: string) {
  const x = String(exam || "").trim().toUpperCase();
  return x === "CAT" || x === "NEET" || x === "JEE" ? x : "";
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = ensureUserId(req);
  try {
    const contentType = req.headers.get("content-type") || "";

    let exam: Exam;
    let intake: Intake;
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      const examRaw = String(form.get("exam") || "");
      const normalizedExam = normalizeExam(examRaw);
      exam = normalizedExam as Exam;

      const intakeRaw = JSON.parse(String(form.get("intake") || "{}"));
      const parsedIntake = intakeSchema.safeParse(intakeRaw);
      if (!parsedIntake.success) {
        const res = NextResponse.json(
          { error: "Invalid intake data." },
          { status: 400 }
        );
        if (session.isNew) attachUserIdCookie(res, session.userId);
        return res;
      }
      intake = parsedIntake.data;

      const pasted = String(form.get("text") || "").trim();
      const file = form.get("file") as File | null;

      if (pasted) text = pasted;

      if (!text && file) {
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          text = await extractTextFromPdf(buf);

          if (!text || text.trim().length < 30) {
            const res = NextResponse.json(
              {
                error:
                  "We couldn’t extract text from this PDF (it may be scanned or image-based). Please paste the mock text instead.",
              },
              { status: 400 }
            );
            if (session.isNew) attachUserIdCookie(res, session.userId);
            return res;
          }
        } catch (e: any) {
          console.error("PDF parse failed:", e?.message ?? e);
          const res = NextResponse.json(
            {
              error:
                "We couldn’t read this PDF (it may be corrupted — e.g., bad xref — or scanned). Please paste the mock text instead.",
            },
            { status: 400 }
          );
          if (session.isNew) attachUserIdCookie(res, session.userId);
          return res;
        }
      }
    } else {
      const body = await req.json();
      const normalizedExam = normalizeExam(body.exam);
      exam = normalizedExam as Exam;

      const parsedIntake = intakeSchema.safeParse(body.intake);
      if (!parsedIntake.success) {
        const res = NextResponse.json(
          { error: "Invalid intake data." },
          { status: 400 }
        );
        if (session.isNew) attachUserIdCookie(res, session.userId);
        return res;
      }
      intake = parsedIntake.data;
      text = String(body.text || "").trim();
    }

    if (!exam) {
      const res = NextResponse.json({ error: "Missing exam" }, { status: 400 });
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    if (!text || text.trim().length < 30) {
      const res = NextResponse.json(
        { error: "No usable text found. Paste your mock/scorecard text and try again." },
        { status: 400 }
      );
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    // ✅ ensure user exists
    await upsertUser(session.userId);

    const detected = detectExamFromText(text);
    if (detected && detected !== exam) {
      const res = NextResponse.json(
        {
          error: `Exam mismatch: your selected exam is ${exam}, but this scorecard looks like ${detected}. Please switch exam and try again.`,
          detectedExam: detected,
        },
        { status: 400 }
      );
      if (session.isNew) attachUserIdCookie(res, session.userId);
      return res;
    }

    const usePython = process.env.ANALYZER_BACKEND === "python";

    const report = usePython
      ? await analyzeViaPython({ exam, intake, text })
      : await analyzeMock({ exam, intake, text });


    // ✅ save attempt to Mongo
    const attemptId = await saveAttempt({
      userId: session.userId,
      exam,
      intake,
      rawText: text,
      report,
    });

    const res = NextResponse.json({ id: attemptId });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  } catch (e: any) {
    console.error("Analyze API failed:", e?.message ?? e);
    const res = NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }
}
