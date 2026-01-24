import type { EventName } from "@/lib/events";
import { fetchWithTimeout } from "@/lib/fetcher";

type TrackEventParams = {
  attemptId?: string;
  metadata?: Record<string, any>;
};

export function trackEvent(eventName: EventName, params: TrackEventParams = {}) {
  const payload = {
    event_name: eventName,
    attempt_id: params.attemptId,
    metadata: params.metadata,
  };

  void fetchWithTimeout("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
    timeoutMs: 2000,
  }).catch(() => {
    // best-effort only
  });
}
