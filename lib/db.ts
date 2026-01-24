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

async function ensureIndex(db: Db, name: string, index: IndexSpecification, options?: any) {
  await db.collection(name).createIndex(index, options);
}

export async function ensureIndexes(db: Db) {
  if (ensured) return ensured;
  ensured = (async () => {
    await Promise.all([
      ensureIndex(db, COLLECTIONS.users, { userId: 1 }, { unique: true }),
      ensureIndex(db, COLLECTIONS.users, { email: 1 }, { unique: true }),
      ensureIndex(db, COLLECTIONS.uploads, { userId: 1, createdAt: -1 }),
      ensureIndex(db, COLLECTIONS.attempts, { userId: 1, createdAt: -1 }),
      ensureIndex(db, COLLECTIONS.analyses, { userId: 1, attemptId: 1 }),
      ensureIndex(db, COLLECTIONS.actions, { userId: 1, analysisId: 1, actionId: 1 }, { unique: true }),
      ensureIndex(db, COLLECTIONS.notes, { userId: 1, analysisId: 1, actionId: 1, createdAt: -1 }),
      ensureIndex(db, COLLECTIONS.events, { userId: 1, timestamp: -1 }),
      ensureIndex(db, COLLECTIONS.events, { userId: 1, eventName: 1, timestamp: -1 }),
    ]);
  })();
  return ensured;
}
