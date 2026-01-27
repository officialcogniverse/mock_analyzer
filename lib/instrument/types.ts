export type InstrumentTemplate = {
  sectionCount: number;
  questionsPerSection: number;
  totalTimeMin: number;
};

export type InstrumentQuestionLog = {
  sectionIndex: number;
  questionIndex: number;
  status: "attempted" | "skipped";
  confidence: "low" | "med" | "high";
  correctness: "correct" | "incorrect" | "unknown";
  timeSpentSec: number;
  errorType?: "concept" | "time" | "careless" | "selection" | "unknown";
  updatedAt: string;
};

export type InstrumentDraft = {
  attemptId: string;
  template: InstrumentTemplate;
  startedAt: string;
  totalTimeSec: number;
  activeSectionIndex: number;
  activeQuestionKey?: string;
  questions: Record<string, InstrumentQuestionLog>;
  timer: {
    running: boolean;
    remainingSec: number;
    lastTickAt?: string;
  };
};
