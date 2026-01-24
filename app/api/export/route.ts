import { NextResponse } from "next/server";
import { ensureUserId, attachUserIdCookie } from "@/lib/session";
import { getUser, listAttemptsForExport } from "@/lib/persist";

export const runtime = "nodejs";

function toCsv(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);

  const escape = (value: any) => {
    const raw = value == null ? "" : String(value);
    const needsQuotes = /[\",\n]/.test(raw);
    const escaped = raw.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

export async function GET(req: Request) {
  const session = ensureUserId(req);
  const url = new URL(req.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();

  const user = await getUser(session.userId);
  const attempts = await listAttemptsForExport(session.userId, 200);

  if (format === "csv") {
    const rows = attempts.map((attempt) => ({
      id: attempt.id,
      exam: attempt.exam,
      created_at: attempt.createdAt,
      summary: attempt.summary,
      estimated_score: attempt.estimated_score?.value ?? "",
      estimated_score_max: attempt.estimated_score?.max ?? "",
      percentile: attempt.percentile ?? "",
      accuracy: attempt.accuracy ?? "",
      strengths: Array.isArray(attempt.strengths) ? attempt.strengths.join(" | ") : "",
      weaknesses: Array.isArray(attempt.weaknesses)
        ? attempt.weaknesses.map((w: any) => w?.topic || "").filter(Boolean).join(" | ")
        : "",
      dominant_error: attempt.error_types
        ? Object.entries(attempt.error_types)
            .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))[0]?.[0]
        : "",
    }));

    const csv = toCsv(rows);
    const res = new NextResponse(csv, {
      headers: {
        "content-type": "text/csv",
        "content-disposition": "attachment; filename=mock_export.csv",
      },
    });
    if (session.isNew) attachUserIdCookie(res, session.userId);
    return res;
  }

  const res = NextResponse.json({
    user: {
      id: user?._id || session.userId,
      displayName: user?.displayName ?? null,
      examDefault: user?.examDefault ?? null,
      profile: user?.profile ?? null,
      auth: user?.auth ?? null,
    },
    attempts,
  });
  if (session.isNew) attachUserIdCookie(res, session.userId);
  return res;
}
