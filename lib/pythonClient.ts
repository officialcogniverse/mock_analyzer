import type { AnalyzeInput } from "@/lib/types";

export async function analyzeViaPython(input: AnalyzeInput) {
  const base = process.env.PY_ANALYZER_URL || "http://localhost:8000";
  const url = `${base}/analyze`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  const raw = await res.text(); // ✅ read raw text first

  // try to parse json, but don't crash if it's plain text
  let data: any = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // not JSON
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.detail ||
      raw?.slice(0, 300) || // show first part of python error
      `Python analyzer failed (${res.status})`;
    throw new Error(msg);
  }

  if (!data?.report) {
    throw new Error(`Python analyzer returned no report. Raw: ${raw.slice(0, 300)}`);
  }

  return data.report;
}
