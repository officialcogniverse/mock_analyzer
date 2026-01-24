import { z } from "zod";

const bandEnum = z.enum(["low", "medium", "high"]);

export const ReportSchema = z.object({
  signal_quality: bandEnum.default("medium"),
  confidence: z.number().min(0).max(100).default(62),
  primary_bottleneck: z.string().min(3),
  summary: z.string().min(20),

  patterns: z
    .array(
      z.object({
        title: z.string().min(3),
        evidence: z.string().min(6),
        impact: z.string().min(6),
        fix: z.string().min(6),
        severity: z.number().int().min(1).max(5).default(3),
      })
    )
    .max(6)
    .default([]),

  next_actions: z
    .array(
      z.object({
        title: z.string().min(3),
        why: z.string().min(6),
        duration_min: z.number().int().min(5).max(180),
        difficulty: z.number().int().min(1).max(5),
        steps: z.array(z.string()).min(1).max(6),
        success_metric: z.string().min(6),
      })
    )
    .max(3)
    .default([]),

  plan: z.object({
    days: z
      .array(
        z.object({
          day_index: z.number().int().min(1),
          label: z.string().min(3),
          focus: z.string().min(6),
          tasks: z
            .array(
              z.object({
                action_id: z.string().optional(),
                title: z.string().min(3),
                duration_min: z.number().int().min(5).max(180),
                note: z.string().optional(),
              })
            )
            .min(1)
            .max(6),
        })
      )
      .min(3)
      .max(14),
  }),

  probes: z
    .array(
      z.object({
        title: z.string().min(3),
        duration_min: z.number().int().min(5).max(90),
        instructions: z.string().min(6),
        success_check: z.string().min(6),
      })
    )
    .min(3)
    .max(5)
    .default([]),

  next_mock_strategy: z.object({
    rules: z.array(z.string()).min(3).max(8),
    time_checkpoints: z.array(z.string()).min(2).max(6),
    skip_policy: z.array(z.string()).min(2).max(6),
  }),

  overall_exam_strategy: z.object({
    weekly_rhythm: z.array(z.string()).min(3).max(7),
    revision_loop: z.array(z.string()).min(3).max(7),
    mock_schedule: z.array(z.string()).min(2).max(6),
  }),

  followups: z
    .array(
      z.object({
        id: z.string(),
        question: z.string().min(6),
        type: z.enum(["single", "text"]),
        options: z.array(z.string()).optional(),
      })
    )
    .max(4)
    .default([]),

  meta: z.record(z.string(), z.any()).optional(),
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
