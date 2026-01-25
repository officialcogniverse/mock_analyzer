import type { Db } from "mongodb";

import { COLLECTIONS } from "@/lib/db";

type MemoryTuple = {
  userId: string;
  exam: string;
  persona: string;
  strategy: string;
  stats: {
    seen: number;
    completedPlans: number;
    avgCompletionRate: number;
    lastOutcome?: "good" | "neutral" | "bad";
  };
  lastUsedAt: Date;
};

export type StrategyContext = {
  id: string;
  exam: string;
  persona: string;
  horizonDays: 7 | 14;
};

export async function loadMemorySummary(db: Db, userId: string, exam: string, persona: string) {
  const tuples = await db
    .collection<MemoryTuple>(COLLECTIONS.memoryTuples)
    .find({ userId, exam, persona })
    .sort({ lastUsedAt: -1 })
    .limit(3)
    .toArray();

  const avoidStrategies = tuples.filter((tuple) => tuple.stats.lastOutcome === "bad").map((tuple) => tuple.strategy);
  return { tuples, avoidStrategies };
}

export function selectStrategy(params: { exam: string; persona: string; avoidStrategies: string[] }): StrategyContext {
  const { exam, persona, avoidStrategies } = params;
  const base = persona === "speed-first" ? "speed_stabilize" : persona === "accuracy-first" ? "accuracy_rebuild" : "steady_rebuild";
  const candidates: StrategyContext[] = [
    { id: `${base}_7d`, exam, persona, horizonDays: 7 },
    { id: `${base}_14d`, exam, persona, horizonDays: 14 },
  ];
  const selected = candidates.find((strategy) => !avoidStrategies.includes(strategy.id)) ?? candidates[0];
  return selected;
}

export async function recordStrategyUsage(db: Db, userId: string, strategy: StrategyContext) {
  const tuples = db.collection<MemoryTuple>(COLLECTIONS.memoryTuples);
  const now = new Date();
  await tuples.updateOne(
    { userId, exam: strategy.exam, persona: strategy.persona, strategy: strategy.id },
    {
      $setOnInsert: {
        stats: {
          seen: 0,
          completedPlans: 0,
          avgCompletionRate: 0,
        },
      },
      $set: { lastUsedAt: now },
      $inc: { "stats.seen": 1 },
    },
    { upsert: true }
  );
}
