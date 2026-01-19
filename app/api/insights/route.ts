import { NextResponse } from "next/server";
import { listAttemptsForInsights } from "@/lib/persist";
import { attachUserIdCookie, ensureUserId } from "@/lib/session";

export const runtime = "nodejs";

function normalizeExam(exam?: string) {
  const x = String(exam || "").trim().toUpperCase();
  return x === "CAT" || x === "NEET" || x === "JEE" ? x : null;
}

export async function GET(req: Request) {
  const session = ensureUserId(req);
  try {
    const url = new URL(req.url);
    const exam = normalizeExam(url.searchParams.get("exam") || "");
    const lastN = Math.min(Number(url.searchParams.get("lastN") || "10"), 30);

    const attempts = await listAttemptsForInsights(session.userId, exam, lastN);

    const py = process.env.PY_ANALYZER_URL || "http://127.0.0.1:8000";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${py}/insights`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: session.userId,
        exam: exam || "ALL",
        attempts,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {}

    if (!res.ok) {
      const errRes = NextResponse.json(
        { error: data?.detail || data?.error || raw || "Python insights failed" },
        { status: 500 }
      );
      if (session.isNew) attachUserIdCookie(errRes, session.userId);
      return errRes;
    }

    const okRes = NextResponse.json(data);
    if (session.isNew) attachUserIdCookie(okRes, session.userId);
    return okRes;
  } catch (e: any) {
    const errRes = NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
    if (session.isNew) attachUserIdCookie(errRes, session.userId);
    return errRes;
  }
}
