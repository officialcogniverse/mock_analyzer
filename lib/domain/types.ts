export type SessionUser = {
  userId: string;
  displayName?: string | null;
  createdAt?: string;
};

export type AttemptMetric = {
  label: string;
  value: string;
  evidence?: string;
};

export type Attempt = {
  id: string;
  userId: string;
  createdAt: string;
  sourceType: "upload" | "text" | "manual";
  rawText?: string;
  metrics: AttemptMetric[];
};

export type ReportPattern = {
  id: string;
  title: string;
  evidence: string;
  impact: string;
  fix: string;
};

export type ReportAction = {
  id: string;
  title: string;
  duration: string;
  expectedImpact: string;
  steps: string[];
};

export type ReportPlanDay = {
  day?: number | string;
  title?: string;
  focus?: string;
  actions?: string[];
};

export type ReportPlan = {
  days: ReportPlanDay[];
  levers: Array<{ title?: string; detail?: string }>;
  rules: string[];
  assumptions: string[];
};

export type ReportConfidence = {
  score: number;
  band: "low" | "medium" | "high";
  assumptions: string[];
  missingSignals: string[];
};

export type SignalQuality = {
  score: number;
  band: "low" | "medium" | "high";
  missingSignals: string[];
};

export type Report = {
  attemptId: string;
  userId: string;
  summary: string;
  patterns: ReportPattern[];
  nextActions: ReportAction[];
  strategy: {
    nextMockScript: string[];
    attemptRules: string[];
  };
  plan: ReportPlan;
  confidence: ReportConfidence;
  signalQuality: SignalQuality;
};

export type ActionState = {
  userId: string;
  attemptId: string;
  actionId: string;
  status: "pending" | "completed" | "skipped";
  updatedAt: string;
  reflection?: string;
};

export type Event = {
  userId: string;
  name: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type AttemptBundle = {
  attempt: Attempt;
  report: Report;
};

export type AttemptDetail = {
  attempt: Attempt;
  report: Report;
  actionState: ActionState[];
  deltaFromPrevious?: {
    previousAttemptId: string;
    summary: string;
    changes: string[];
  } | null;
};
