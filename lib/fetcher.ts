const DEFAULT_TIMEOUT_MS = 8000;

type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
};

type JsonCapable = {
  json: () => Promise<unknown>;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readJsonSafely<T>(target: JsonCapable): Promise<T | null> {
  try {
    return (await target.json()) as T;
  } catch {
    return null;
  }
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function withFriendlyTimeoutMessage(message: string, fallback: string) {
  const text = String(message || "").toLowerCase();
  if (text.includes("abort")) return fallback;
  return message;
}
