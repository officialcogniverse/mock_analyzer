import { NextResponse } from "next/server";
import { analyzeMock } from "@/lib/analyzer";
import { extractTextFromPdf } from "@/lib/extractText";
import { detectExamFromText } from "@/lib/examDetect";
import type { Exam, Intake } from "@/lib/types";
import { upsertUser, saveAttempt } from "@/lib/persist";
import { analyzeViaPython } from "@/lib/pythonClient";


export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let userId = "";
    let exam: Exam;
    let intake: Intake;
    let text = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();

      userId = String(form.get("userId") || "").trim();
      exam = form.get("exam") as Exam;
      exam = String(exam || "").trim().toUpperCase() as Exam;

      intake = JSON.parse(String(form.get("intake") || "{}")) as Intake;

      const pasted = String(form.get("text") || "").trim();
      const file = form.get("file") as File | null;

      if (pasted) text = pasted;

      if (!text && file) {
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          text = await extractTextFromPdf(buf);

          if (!text || text.trim().length < 30) {
            return NextResponse.json(
              {
                error:
                  "We couldn’t extract text from this PDF (it may be scanned or image-based). Please paste the mock text instead.",
              },
              { status: 400 }
            );
          }
        } catch (e: any) {
          console.error("PDF parse failed:", e?.message ?? e);
          return NextResponse.json(
            {
              error:
                "We couldn’t read this PDF (it may be corrupted — e.g., bad xref — or scanned). Please paste the mock text instead.",
            },
            { status: 400 }
          );
        }
      }
    } else {
      const body = await req.json();
      userId = String(body.userId || "").trim();
      exam = body.exam;
      intake = body.intake;
      text = String(body.text || "").trim();
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (!exam) {
      return NextResponse.json({ error: "Missing exam" }, { status: 400 });
    }

    if (!text || text.trim().length < 30) {
      return NextResponse.json(
        { error: "No usable text found. Paste your mock/scorecard text and try again." },
        { status: 400 }
      );
    }

    // ✅ ensure user exists
    await upsertUser(userId);

    const detected = detectExamFromText(text);
    if (detected && detected !== exam) {
      return NextResponse.json(
        {
          error: `Exam mismatch: your selected exam is ${exam}, but this scorecard looks like ${detected}. Please switch exam and try again.`,
          detectedExam: detected,
        },
        { status: 400 }
      );
    }

    const usePython = process.env.ANALYZER_BACKEND === "python";

    const report = usePython
      ? await analyzeViaPython({ exam, intake, text })
      : await analyzeMock({ exam, intake, text });


    // ✅ save attempt to Mongo
    const attemptId = await saveAttempt({
      userId,
      exam,
      intake,
      rawText: text,
      report,
    });

    return NextResponse.json({ id: attemptId });
  } catch (e: any) {
    console.error("Analyze API failed:", e?.message ?? e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
