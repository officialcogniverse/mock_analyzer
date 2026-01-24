export async function trackEvent(event: string, metadata?: Record<string, any>) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, metadata }),
    });
  } catch {
    // best-effort only
  }
}
