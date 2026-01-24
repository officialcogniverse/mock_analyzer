import { getDb } from "@/lib/mongodb";
import { COLLECTIONS, ensureIndexes } from "@/lib/db";

export async function getUserById(userId: string) {
  const db = await getDb();
  await ensureIndexes(db);
  return db.collection(COLLECTIONS.users).findOne({ userId });
}

export async function assertActiveUser(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;
  if (user.deletedAt) {
    return { ...user, blocked: true };
  }
  return { ...user, blocked: false };
}
