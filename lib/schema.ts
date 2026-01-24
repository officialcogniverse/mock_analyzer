import { z } from "zod";

export const ReportSchema = z.object({
  summary: z.string(),

  facts: z.object({
    metrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          evidence: z.string(),
        })
      )
      .default([]),
    notes: z.array(z.string()).default([]),
  }),

  inferences: z
    .array(
      z.object({
        hypothesis: z.string(),
        confidence: z.enum(["low", "medium", "high"]),
        evidence: z.string(),
      })
    )
    .default([]),

  patterns: z
    .array(
      z.object({
        title: z.string(),
        evidence: z.string(),
        impact: z.string(),
        fix: z.string(),
      })
    )
    .max(6)
    .default([]),

  next_actions: z
    .array(
      z.object({
        title: z.string(),
        duration: z.string(),
        expected_impact: z.string(),
        steps: z.array(z.string()).optional(),
      })
    )
    .max(3)
    .default([]),

  strategy: z.object({
    next_mock_script: z.array(z.string()).min(3).max(8),
    attempt_rules: z.array(z.string()).min(2).max(8),
  }),

  followups: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        type: z.enum(["single_select", "boolean", "text"]),
        options: z.array(z.string()).optional(),
        reason: z.string(),
      })
    )
    .max(4)
    .default([]),

  meta: z.record(z.any()).optional(),
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
