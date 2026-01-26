import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db";
import { createDefaultState, type EventRecord, type UserState } from "@/lib/state/envelope";

const STATE_COLLECTION = "user_state";
const EVENT_COLLECTION = "events";

async function withDb<T>(handler: (db: Awaited<ReturnType<typeof getDb>>) => Promise<T>): Promise<T | null> {
  try {
    const db = await getDb();
    await ensureIndexes(db);
    return await handler(db);
  } catch {
    return null;
  }
}

export async function getUserState(userId: string): Promise<UserState> {
  const fallback = createDefaultState(userId);
  const result = await withDb(async (db) => {
    const doc = await db.collection<UserState>(STATE_COLLECTION).findOne({ userId });
    return doc ?? null;
  });

  return result ?? fallback;
}

export async function saveUserState(state: UserState): Promise<void> {
  await withDb(async (db) => {
    await db.collection<UserState>(STATE_COLLECTION).updateOne(
      { userId: state.userId },
      { $set: state },
      { upsert: true }
    );
    return null;
  });
}

export async function logEvent(event: EventRecord): Promise<void> {
  await withDb(async (db) => {
    await db.collection<EventRecord>(EVENT_COLLECTION).insertOne(event);
    return null;
  });
}
