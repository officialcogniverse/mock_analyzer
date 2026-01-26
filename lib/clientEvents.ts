export type ClientEventPayload = Record<string, unknown>;

export async function emitEvent(type: string, payload?: ClientEventPayload) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        payload: payload ?? {},
        ts: new Date().toISOString(),
      }),
    });
  } catch {
    // fire-and-forget
  }
}
