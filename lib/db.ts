import type { Db, IndexSpecification } from "mongodb";

export const COLLECTIONS = {
  users: "users",
  uploads: "uploads",
  attempts: "attempts",
  analyses: "analyses",
  actions: "actions",
  notes: "notes",
  events: "events",
} as const;

let ensured: Promise<void> | null = null;

async function ensureIndex(
  db: Db,
  name: (typeof COLLECTIONS)[keyof typeof COLLECTIONS],
  index: IndexSpecification,
  options?: any
) {
  await db.collection(name).createIndex(index, options);
}

export async function ensureIndexes(db: Db) {
  if (ensured) return ensured;

  ensured = (async () => {
    // USERS — single identity index (userId = normalized email)
    await ensureIndex(db, COLLECTIONS.users, { userId: 1 }, { unique: true, name: "users_userId_unique" });

    // UPLOADS
    await ensureIndex(db, COLLECTIONS.uploads, { userId: 1, createdAt: -1 });

    // ATTEMPTS
    await ensureIndex(db, COLLECTIONS.attempts, { userId: 1, createdAt: -1 });

    // ANALYSES
    await ensureIndex(db, COLLECTIONS.analyses, { userId: 1, attemptId: 1 });

    // ACTIONS — one record per action completion
    await ensureIndex(db, COLLECTIONS.actions, { userId: 1, analysisId: 1, actionId: 1 }, { unique: true });

    // NOTES — recency per action
    await ensureIndex(db, COLLECTIONS.notes, { userId: 1, analysisId: 1, actionId: 1, createdAt: -1 });

    // EVENTS — for nudges + history
    await ensureIndex(db, COLLECTIONS.events, { userId: 1, timestamp: -1 });
    await ensureIndex(db, COLLECTIONS.events, { userId: 1, eventName: 1, timestamp: -1 });
  })();

  return ensured;
}
