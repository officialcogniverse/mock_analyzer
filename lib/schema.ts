import { z } from "zod";

export const ReportSchema = z.object({
  summary: z.string(),

  /**
   * Optional global assumptions inferred due to missing data
   */
  assumptions: z.array(z.string()).optional(),

  estimated_score: z.object({
    value: z.number().nullable(),
    max: z.number().nullable(),

    // array length(2) instead of tuple to avoid schema errors
    range: z.array(z.number()).length(2).nullable(),

    confidence: z.enum(["low", "medium", "high"]),
    assumptions: z.array(z.string()),
  }),

  strengths: z.array(z.string()),

  weaknesses: z.array(
    z.object({
      topic: z.string(),
      reason: z.string(),
      severity: z.number().min(1).max(5),
    })
  ),

  error_types: z.object({
    conceptual: z.number().min(0).max(100),
    careless: z.number().min(0).max(100),
    time: z.number().min(0).max(100),
    comprehension: z.number().min(0).max(100),
  }),

  top_actions: z.array(z.string()).min(3).max(8),

  /**
   * Study plan (adaptive length, not fixed 14 days)
   */
  study_plan: z.array(
    z.object({
      day: z.number().min(1),
      focus: z.string(),
      tasks: z.array(z.string()).min(2).max(6),
      time_minutes: z.number().min(15).max(360),
    })
  ),

  next_mock_strategy: z.array(z.string()).min(3).max(8),
});

export type Report = z.infer<typeof ReportSchema>;

export const InsightSchema = z.object({
  trend: z.string().optional(),
  dominant_error: z.string().optional(),
  consistency: z.string().optional(),
  volatility: z.number().optional(),
  risk_zone: z.string().optional(),
  personas: z.array(z.string()).optional(),
  learning_curve: z
    .array(
      z.object({
        index: z.number().optional(),
        xp: z.number().optional(),
        date: z.string().nullable().optional(),
      })
    )
    .optional(),
  learning_behavior: z
    .object({
      cadence: z.string().optional(),
      streak_days: z.number().optional(),
      weekly_activity: z.number().optional(),
      responsiveness: z.string().optional(),
      delta_xp: z.number().optional(),
      stuck_loop: z
        .object({
          active: z.boolean().optional(),
          topic: z.string().nullable().optional(),
        })
        .optional(),
      execution_style: z.string().optional(),
      confidence: z.string().optional(),
      evidence: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Insight = z.infer<typeof InsightSchema>;

export const NextActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  steps: z.array(z.string()).optional(),
  metric: z.string().optional(),
  expectedImpact: z.enum(["High", "Medium", "Low"]).optional(),
  effort: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  why: z.string().optional(),
  duration: z.string().optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
});

export type NextAction = z.infer<typeof NextActionSchema>;
