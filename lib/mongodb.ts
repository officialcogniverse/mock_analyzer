import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

export const clientPromise = uri
  ? globalForMongo._mongoClientPromise ?? new MongoClient(uri).connect()
  : null;

if (process.env.NODE_ENV !== "production") {
  if (clientPromise) {
    globalForMongo._mongoClientPromise = clientPromise;
  }
}

export async function getDb() {
  if (!uri || !clientPromise) {
    throw new Error("Missing MONGODB_URI in .env.local");
  }
  const client = await clientPromise;
  const dbName = process.env.MONGODB_DB || "cogniverse";
  return client.db(dbName);
}
