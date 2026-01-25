import type { Db, IndexSpecification } from "mongodb";

export const COLLECTIONS = {
  attempts: "attempts",
  recommendations: "recommendations",
  memoryTuples: "memory_tuples",
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
    // ATTEMPTS
    await ensureIndex(db, COLLECTIONS.attempts, { userId: 1, createdAt: -1 });

    // RECOMMENDATIONS
    await ensureIndex(db, COLLECTIONS.recommendations, { userId: 1, createdAt: -1 });
    await ensureIndex(db, COLLECTIONS.recommendations, { attemptId: 1 }, { unique: true });

    // MEMORY TUPLES
    await ensureIndex(
      db,
      COLLECTIONS.memoryTuples,
      { userId: 1, exam: 1, persona: 1, strategy: 1 },
      { unique: true }
    );
  })();

  return ensured;
}
