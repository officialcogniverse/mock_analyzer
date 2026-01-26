export type UserState = {
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  signals: Record<string, unknown>;
  facts: Record<string, unknown>;
  preferences: Record<string, unknown>;
  history: {
    recentEventIds: string[];
  };
};

export type StatePatch = Partial<Omit<UserState, "userId" | "createdAt">>;

const nowIso = () => new Date().toISOString();

export function createDefaultState(userId: string): UserState {
  const now = nowIso();
  return {
    userId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    signals: {},
    facts: {},
    preferences: {},
    history: {
      recentEventIds: [],
    },
  };
}

export function mergeState(base: UserState, patch: StatePatch): UserState {
  const nextSignals = { ...base.signals, ...(patch.signals ?? {}) };
  const nextFacts = { ...base.facts, ...(patch.facts ?? {}) };
  const nextPreferences = { ...base.preferences, ...(patch.preferences ?? {}) };

  return {
    ...base,
    ...patch,
    version: Math.max(base.version + 1, patch.version ?? 0),
    signals: nextSignals,
    facts: nextFacts,
    preferences: nextPreferences,
    history: {
      recentEventIds: patch.history?.recentEventIds ?? base.history.recentEventIds,
    },
    updatedAt: nowIso(),
  };
}

export type EventRecord = {
  eventId: string;
  userId: string;
  type: string;
  ts: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  requestId?: string;
};

export function applyEventToState(state: UserState, event: EventRecord): UserState {
  const next = { ...state };
  const nextSignals = { ...state.signals };
  const nextFacts = { ...state.facts };
  const recentEventIds = [event.eventId, ...state.history.recentEventIds].slice(0, 25);

  switch (event.type) {
    case "mock_analyzed":
      nextFacts.lastMock = {
        ts: event.ts,
        source: event.payload?.source,
        extractedChars: event.payload?.extractedChars,
        summary: event.payload?.summary,
      };
      break;
    case "plan_generated":
      nextFacts.lastPlan = {
        ts: event.ts,
        horizonDays: event.payload?.horizonDays,
        actionCount: event.payload?.actionCount,
      };
      break;
    case "action_started":
    case "action_completed":
    case "action_skipped": {
      const actionId = event.payload?.actionId;
      if (typeof actionId === "string") {
        const statusMap = (nextFacts.actionStatus as Record<string, unknown>) ?? {};
        nextFacts.actionStatus = {
          ...statusMap,
          [actionId]: {
            status: event.type.replace("action_", ""),
            ts: event.ts,
          },
        };
      }
      break;
    }
    case "user_feedback":
      nextSignals.feedback = {
        ts: event.ts,
        ...event.payload,
      };
      break;
    case "chat_message":
      nextFacts.lastChatMessage = {
        ts: event.ts,
        role: event.payload?.role,
        content: event.payload?.content,
      };
      break;
    case "intake_updated":
      nextFacts.intake = {
        ...((nextFacts.intake as Record<string, unknown>) ?? {}),
        ...event.payload,
      };
      break;
    default:
      nextFacts.lastUnknownEvent = {
        ts: event.ts,
        type: event.type,
        payload: event.payload,
      };
  }

  next.signals = nextSignals;
  next.facts = nextFacts;
  next.history = { recentEventIds };
  next.version = state.version + 1;
  next.updatedAt = nowIso();

  return next;
}

export function safeGet<T>(state: UserState, path: string[], fallback: T): T {
  let current: any = state;
  for (const key of path) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return fallback;
    }
  }
  return (current as T) ?? fallback;
}
