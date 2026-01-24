import { NextResponse } from "next/server";
import { listAttemptsForInsights } from "@/lib/persist";
import { attachSessionCookie, ensureSession } from "@/lib/session";
import { normalizeExam } from "@/lib/exams";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = ensureSession(req);
  if (session.mode !== "student") {
    const res = NextResponse.json({ error: "Insights are student-only." }, { status: 403 });
    if (session.isNew) attachSessionCookie(res, session);
    return res;
  }

  try {
    const url = new URL(req.url);
    const exam = normalizeExam(url.searchParams.get("exam") || "");

    const rawLastN = Number(url.searchParams.get("lastN") || "10");
    const lastN = Math.max(1, Math.min(30, Number.isFinite(rawLastN) ? rawLastN : 10));

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
      cache: "no-store",
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
      if (session.isNew) attachSessionCookie(errRes, session);
      return errRes;
    }

    const okRes = NextResponse.json(data);
    if (session.isNew) attachSessionCookie(okRes, session);
    return okRes;
  } catch (e: any) {
    const errRes = NextResponse.json(
      { error: e?.message || "Unknown error" },
      { status: 500 }
    );
    if (session.isNew) attachSessionCookie(errRes, session);
    return errRes;
  }
}
