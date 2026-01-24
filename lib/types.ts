export type { Exam } from "./exams";
export type { Insight, NextAction, Report } from "./schema";

/**
 * Core intake (always asked)
 */
export type Intake = {
  goal: "score" | "accuracy" | "speed" | "concepts";
  hardest: "selection" | "time" | "concepts" | "careless" | "anxiety" | "consistency";
  weekly_hours: "<10" | "10-20" | "20-35" | "35+";
  section?: string;

  /**
   * ===== Adaptive boosters (OPTIONAL) =====
   * These are only asked when signal coverage is low.
   * They should NEVER be required.
   */
  next_mock_days?: "3" | "7" | "14" | "21" | "30+";
  next_mock_date?: string;
  runs_out_of_time?: "yes" | "no";
  tukka_level?: "low" | "medium" | "high";
  chaotic_section?: string;
  daily_minutes?: string;
  preferred_topics?: string;
};

export type ProfileSignals = {
  displayName?: string | null;
  targetExamLabel?: string | null;
  goal?: "score" | "accuracy" | "speed" | "concepts";
  nextMockDate?: string | null;
  dailyStudyMinutes?: number | null;
  biggestStruggle?: string | null;
  timezone?: string | null;
};

export type AttemptHistorySignal = {
  id: string;
  created_at: string;
  exam: string;
  confidence?: number | null;
  signal_quality?: "low" | "medium" | "high" | null;
  primary_bottleneck?: string | null;
  accuracy_pct?: number | null;
};

export type AnalyzeInput = {
  exam: string;
  intake: Intake;
  text: string;
  context?: {
    profile?: ProfileSignals;
    history?: AttemptHistorySignal[];
    plan_days?: number;
  };
};

/**
 * ========= Strategy / Confidence Meta =========
 * Stored under report.meta.strategy
 */

export type StrategyConfidenceBand = "high" | "medium" | "low";

export type NextQuestion = {
  id: keyof Intake | string;
  question: string;
  type: "boolean" | "single_select" | "text";
  options?: string[];
  unlocks: string[];
};

export type StrategyMeta = {
  confidence_score: number; // 0–100
  confidence_band: StrategyConfidenceBand;
  missing_signals: string[];
  assumptions: string[];
  next_questions: NextQuestion[]; // max 2
};
