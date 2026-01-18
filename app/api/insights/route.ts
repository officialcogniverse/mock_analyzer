import { NextResponse } from "next/server";
import { listAttemptsForInsights } from "@/lib/persist";

export const runtime = "nodejs";

function normalizeExam(exam?: string) {
  const x = String(exam || "").trim().toUpperCase();
  return x === "CAT" || x === "NEET" || x === "JEE" ? x : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId") || "";
    const exam = normalizeExam(url.searchParams.get("exam") || "");
    const lastN = Math.min(Number(url.searchParams.get("lastN") || "10"), 30);

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const attempts = await listAttemptsForInsights(userId, exam, lastN);

    const py = process.env.PY_ANALYZER_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${py}/insights`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId,
        exam: exam || "ALL",
        attempts,
      }),
    });

    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {}

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || raw || "Python insights failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
