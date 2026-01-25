export type GoalFocus = "Score" | "Accuracy" | "Speed" | "Concepts";

export type SignalQuality = "Low" | "Medium" | "High";

export type Severity = "low" | "medium" | "high" | "critical";

export type StrategyConfidenceSource = "attempt" | "self-report" | "derived" | "historical" | "assumption";

export interface Attempt {
  id: string;
  examLabel?: string;
  date: string;
  score: number;
  accuracy: number;
  speed: number;
  risk: number;
  consistency: number;
  timeTakenMinutes: number;
  percentile?: number;
  sections: Array<{
    name: string;
    accuracy: number;
    speed: number;
    attempts: number;
    correct: number;
  }>;
  notes?: string;
  source?: "upload" | "manual" | "text";
}

export interface PersonaHypothesis {
  id: string;
  label:
    | "High-variance sprinter"
    | "Overthinker"
    | "Risky guesser"
    | "Careless drifter"
    | "Slow stabilizer";
  confidence: number;
  why: string[];
  signals: string[];
  assumptions: string[];
}

export interface PatternInsight {
  id: string;
  title: string;
  severity: Severity;
  evidence: string;
  fix: string;
  isHypothesis?: boolean;
  tags: string[];
}

export interface NextBestAction {
  id: string;
  title: string;
  summary: string;
  durationMinutes: number;
  difficulty: "Easy win" | "Focused" | "Deep work";
  whyThisHelps: string;
  steps: Array<{ id: string; label: string }>;
  tags: string[];
  relatedPatternIds: string[];
  energy: "low" | "medium" | "high";
  impact: number;
  isCompleted?: boolean;
  locked?: boolean;
  lockReason?: string;
}

export interface PlanTask {
  id: string;
  actionId?: string;
  title: string;
  durationMinutes: number;
  type: "drill" | "review" | "mock" | "recovery";
  why: string;
  completed?: boolean;
  tags: string[];
  locked?: boolean;
}

export interface PlanDay {
  id: string;
  dayIndex: number;
  label: string;
  date: string;
  focus: string;
  tasks: PlanTask[];
  milestone?: string;
  status: "completed" | "current" | "upcoming";
  energyHint: "low" | "medium" | "high";
  locked?: boolean;
}

export interface Note {
  id: string;
  createdAt: string;
  title: string;
  body: string;
  tags: string[];
  linkedActionId?: string;
  linkedAttemptId?: string;
  isPinned?: boolean;
}

export interface StrategyEvidence {
  id: string;
  source: StrategyConfidenceSource;
  label: string;
  detail: string;
  weight: number;
}

export interface StrategyRecommendation {
  id: string;
  name: string;
  summary: string;
  bottleneck: string;
  signalQuality: SignalQuality;
  confidence: number;
  assumptions: string[];
  signals: StrategyEvidence[];
  confidenceNotes: string[];
}

export type PlanVariantDays = 3 | 5 | 7;

export interface ReportHero {
  primaryBottleneck: string;
  upliftRange: string;
  dailyCommitmentMinutes: number;
}

export interface TrustBreakdown {
  signals: string[];
  assumptions: string[];
  confidenceBand: "high" | "medium" | "low";
  reasoning: string;
  locked?: boolean;
}

export interface PaywallState {
  isPremium: boolean;
  lockedActionIds: readonly string[];
  lockedPlan: boolean;
  lockedReasoning: boolean;
  lockedProgress: boolean;
  ctaLabel: string;
  ctaHint: string;
}

export interface LearningSnapshot {
  exam: string;
  primaryBottleneck: string;
  chosenStrategy: string;
  actionCompletionRate: number;
  nextMockOutcome?: string | null;
  lastUpdated: string;
}

export interface Report {
  id: string;
  generatedAt: string;
  goal: GoalFocus;
  streakDays: number;
  weeklyCompletion: Array<{ day: string; completed: number }>;
  confidenceHistory: Array<{ label: string; confidence: number }>;
  attempts: Attempt[];
  currentAttemptId: string;
  patterns: PatternInsight[];
  actions: NextBestAction[];
  plan: PlanDay[];
  notes: Note[];
  personas: PersonaHypothesis[];
  strategy: StrategyRecommendation;
  deltas: {
    accuracy: number;
    speed: number;
    risk: number;
    consistency: number;
  };
  strategyTimeline: Array<{
    id: string;
    label: string;
    why: string;
    confidenceChange: number;
    date: string;
  }>;
  hero: ReportHero;
  trust: TrustBreakdown;
  paywall: PaywallState;
  learning: LearningSnapshot;
  planVariant: PlanVariantDays;
  availablePlanVariants: PlanVariantDays[];
}

export interface IntakeFormState {
  examLabel: string;
  goal: GoalFocus;
  nextMockDays: string;
  weeklyHours: string;
  biggestStruggle: string;
  dailyCommitmentMinutes: string;
}

export interface TuneStrategyAnswers {
  timeSplitKnown: "yes" | "no";
  timeSink: string;
  mocksPerWeek: string;
  stressLevel: string;
  weakestTags: string[];
}

export interface CogniverseState {
  report: Report;
  intake: IntakeFormState;
  tunedAnswers?: TuneStrategyAnswers;
}
