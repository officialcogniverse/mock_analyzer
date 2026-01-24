import type { EventDoc } from "@/lib/events";

export function buildNudges(params: {
  events: EventDoc[];
  lastActionDoneAt?: Date | null;
}) {
  const nudges: Array<{ id: string; message: string }> = [];
  const now = Date.now();

  if (params.lastActionDoneAt) {
    const diffDays = (now - params.lastActionDoneAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 3) {
      nudges.push({
        id: "stale-actions",
        message: "It’s been a few days since you checked off an action. Pick one small win today.",
      });
    }
  }

  const uploads = params.events.filter((event) => event.eventName === "upload_attempt").length;
  const views = params.events.filter((event) => event.eventName === "view_actions").length;

  if (uploads >= 2 && views === 0) {
    nudges.push({
      id: "view-actions",
      message: "You’ve uploaded a couple of mocks—review your next actions to lock in the gains.",
    });
  }

  return nudges;
}
