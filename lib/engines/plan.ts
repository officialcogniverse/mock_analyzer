import { nanoid } from "nanoid";

import type { NBAAction, Plan } from "@/lib/schemas/workflow";

export function buildPlan(actions: NBAAction[], horizonDays: 7 | 14): Plan {
  const days = Array.from({ length: horizonDays }, (_, index) => ({
    dayIndex: index + 1,
    title: `Day ${index + 1}`,
    tasks: [] as Plan["days"][number]["tasks"],
  }));

  const tasks = actions.map((action) => ({
    id: nanoid(),
    title: action.title,
    linkedNbaId: action.id,
    estMinutes: action.effortLevel === "S" ? 30 : action.effortLevel === "M" ? 60 : 90,
    status: "todo" as const,
  }));

  tasks.forEach((task, index) => {
    const dayIndex = index % days.length;
    days[dayIndex].tasks.push(task);
    if (days[dayIndex].tasks.length === 1) {
      days[dayIndex].title = `Day ${dayIndex + 1}: ${task.title}`;
    }
  });

  days.forEach((day, index) => {
    if (day.tasks.length === 0) {
      const fillerTask = {
        id: nanoid(),
        title: "Light review + error log refresh",
        estMinutes: 30,
        status: "todo" as const,
      };
      day.tasks.push(fillerTask);
      day.title = `Day ${index + 1}: ${fillerTask.title}`;
    }
  });

  return {
    horizonDays,
    days,
  };
}
