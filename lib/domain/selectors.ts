import type { NextBestAction, PlanDay, PlanTask, Report } from "./types";

export const deriveTodayPlan = (plan: PlanDay[]): PlanDay => {
  const current = plan.find((day) => day.status === "current");
  if (current) return current;

  const firstUpcoming = plan.find((day) => day.status === "upcoming");
  if (firstUpcoming) return { ...firstUpcoming, status: "current" };

  const last = plan[plan.length - 1];
  return last ?? {
    id: "plan-fallback",
    dayIndex: 1,
    label: "Day 1",
    date: new Date().toISOString(),
    focus: "Baseline plan",
    tasks: [],
    status: "current",
    energyHint: "medium",
  };
};

export const planCompletion = (day: PlanDay) => {
  if (!day.tasks.length) return 0;
  const completed = day.tasks.filter((task) => task.completed).length;
  return Math.round((completed / day.tasks.length) * 100);
};

export const completedTasks = (tasks: PlanTask[]) => tasks.filter((task) => task.completed).length;

export const deriveBaselinePlanFromActions = (actions: NextBestAction[]): PlanDay => ({
  id: "plan-generated",
  dayIndex: 1,
  label: "Generated Day",
  date: new Date().toISOString(),
  focus: "Close the fastest loop",
  status: "current",
  energyHint: "medium",
  tasks: actions.slice(0, 3).map((action, index) => ({
    id: `generated-task-${index}`,
    actionId: action.id,
    title: action.title,
    durationMinutes: action.durationMinutes,
    type: "drill",
    why: action.whyThisHelps,
    tags: action.tags,
    completed: action.isCompleted,
  })),
});

export const computeStreakIntensity = (report: Report) => {
  const completedToday = report.plan
    .flatMap((day) => day.tasks)
    .filter((task) => task.completed)
    .slice(0, report.streakDays).length;

  return Math.min(100, 40 + completedToday * 6);
};

export const buildAttemptTrend = (report: Report) =>
  report.attempts.map((attempt, index) => ({
    name: `Mock ${index + 1}`,
    score: attempt.score,
    accuracy: attempt.accuracy,
    speed: attempt.speed,
  }));

export const buildConfidenceTrend = (report: Report) => report.confidenceHistory;

export const findActionById = (report: Report, actionId?: string) =>
  actionId ? report.actions.find((action) => action.id === actionId) : undefined;
