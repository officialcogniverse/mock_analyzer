export type Exam = "CAT" | "NEET" | "JEE";

export type Intake = {
  goal: "score" | "accuracy" | "speed" | "concepts";
  hardest: "selection" | "time" | "concepts" | "careless" | "anxiety";
  weekly_hours: "<10" | "10-20" | "20-35" | "35+";
  section?: string;
};

export type AnalyzeInput = {
  exam: Exam;
  intake: Intake;
  text: string;
};
