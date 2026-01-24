export type SessionUser = {
  userId: string;
  displayName?: string | null;
  createdAt?: string;
};

export type StudentProfile = {
  displayName: string;
  targetExamLabel?: string | null;
  goal: "score" | "accuracy" | "speed" | "concepts";
  nextMockDate?: string | null;
  dailyStudyMinutes: number;
  biggestStruggle?: string | null;
  timezone: string;
};

export type AttemptMetric = {
  label: string;
  value: string;
  evidence?: string;
};

export type Attempt = {
  id: string;
  user_id: string;
  userId?: string;
  created_at: string;
  createdAt?: string;
  source_type: "upload" | "text" | "manual";
  sourceType?: "upload" | "text" | "manual";
  raw_text?: string;
  rawText?: string;
  metrics: AttemptMetric[];
  exam: string;
};

export type ReportPattern = {
  id: string;
  title: string;
  evidence: string;
  impact: string;
  fix: string;
  severity: number;
};

export type ReportAction = {
  id: string;
  title: string;
  why: string;
  duration_min: number;
  duration?: string;
  difficulty: number;
  steps: string[];
  success_metric: string;
  expectedImpact?: string;
};

export type ReportPlanTask = {
  action_id?: string;
  actionId?: string;
  title: string;
  duration_min: number;
  durationMin?: number;
  note?: string;
};

export type ReportPlanDay = {
  day_index: number;
  dayIndex?: number;
  label: string;
  focus: string;
  tasks: ReportPlanTask[];
};

export type ReportPlan = {
  days: ReportPlanDay[];
};

export type ReportProbe = {
  id: string;
  title: string;
  duration_min: number;
  durationMin?: number;
  instructions: string;
  success_check: string;
};

export type Report = {
  report_id: string;
  reportId?: string;
  user_id: string;
  userId?: string;
  attempt_id: string;
  attemptId?: string;
  created_at: string;
  createdAt?: string;
  signal_quality: "low" | "medium" | "high";
  signalQuality?: "low" | "medium" | "high";
  confidence: number;
  primary_bottleneck: string;
  primaryBottleneck?: string;
  summary: string;
  patterns: ReportPattern[];
  next_actions: ReportAction[];
  nextActions?: ReportAction[];
  plan: ReportPlan;
  probes: ReportProbe[];
  next_mock_strategy: {
    rules: string[];
    time_checkpoints: string[];
    timeCheckpoints?: string[];
    skip_policy: string[];
    skipPolicy?: string[];
  };
  nextMockStrategy?: {
    rules: string[];
    time_checkpoints: string[];
    skip_policy: string[];
  };
  overall_exam_strategy: {
    weekly_rhythm: string[];
    weeklyRhythm?: string[];
    revision_loop: string[];
    revisionLoop?: string[];
    mock_schedule: string[];
    mockSchedule?: string[];
  };
  overallExamStrategy?: {
    weekly_rhythm: string[];
    revision_loop: string[];
    mock_schedule: string[];
  };
  followups: Array<{
    id: string;
    question: string;
    type: "single" | "text";
    options?: string[];
  }>;
  meta?: Record<string, unknown>;
};

export type ActionState = {
  user_id: string;
  userId?: string;
  attempt_id: string;
  attemptId?: string;
  action_id: string;
  actionId?: string;
  status: "pending" | "completed" | "skipped";
  updated_at: string;
  updatedAt?: string;
  reflection?: string;
};

export type Event = {
  user_id: string;
  name: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type AttemptBundle = {
  attempt: Attempt;
  report: Report;
  profile?: StudentProfile | null;
};

export type AttemptDetail = {
  attempt: Attempt;
  report: Report;
  profile?: StudentProfile | null;
  action_state: ActionState[];
  actionState?: ActionState[];
  delta_from_previous?: {
    previous_attempt_id: string;
    previousAttemptId?: string;
    summary: string;
    changes: string[];
  } | null;
  deltaFromPrevious?: {
    previous_attempt_id: string;
    summary: string;
    changes: string[];
  } | null;
};
