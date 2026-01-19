import type { AnalyzeInput } from "@/lib/types";

function getBaseUrl() {
  // Prefer explicit env var in Next server runtime
  const base =
    process.env.PY_ANALYZER_URL ||
    process.env.PYTHON_SERVICE_URL ||
    "http://localhost:8000";
  return base.replace(/\/+$/, ""); // remove trailing slash
}

export async function analyzeViaPython(input: AnalyzeInput) {
  const base = getBaseUrl();
  const url = `${base}/analyze`;

  // Python + LLM calls can easily take 30–90s (sometimes more).
  // Use a safer timeout; tune later.
  const controller = new AbortController();
  const TIMEOUT_MS = Number(process.env.PY_ANALYZE_TIMEOUT_MS || 120000); // 120s default
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
      // keepalive can help in some environments; harmless in Node
      keepalive: true as any,
    });
  } catch (e: any) {
    // Give a readable error for abort / network
    if (e?.name === "AbortError") {
      throw new Error(
        `Python analyzer timed out after ${Math.round(TIMEOUT_MS / 1000)}s. ` +
          `Increase PY_ANALYZE_TIMEOUT_MS or speed up the python analyzer. URL: ${url}`
      );
    }
    throw new Error(`Python analyzer request failed: ${e?.message ?? String(e)} (URL: ${url})`);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await res.text();

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
      raw?.slice(0, 500) ||
      `Python analyzer failed (${res.status})`;
    throw new Error(msg);
  }

  // Support either {report: ...} or raw report payload
  const report = data?.report ?? data;

  if (!report) {
    throw new Error(`Python analyzer returned no report. Raw: ${raw.slice(0, 500)}`);
  }

  return report;
}
