import { z } from "zod";

export const ErrorTypeSchema = z.enum(["concept", "time", "careless", "selection", "unknown"]);

export const AnalysisErrorSchema = z
  .object({
    type: ErrorTypeSchema.default("unknown"),
    detail: z.string().default(""),
    severity: z.number().int().min(1).max(3).default(2),
  })
  .default({
    type: "unknown",
    detail: "",
    severity: 2,
  });

export const NextBestActionSchema = z
  .object({
    title: z.string().default(""),
    why: z.string().default(""),
    steps: z.array(z.string()).default([]),
    etaMins: z.number().int().min(0).default(0),
  })
  .default({
    title: "",
    why: "",
    steps: [],
    etaMins: 0,
  });

export const PlanTaskSchema = z
  .object({
    title: z.string().default(""),
    minutes: z.number().int().min(0).default(0),
    done: z.boolean().default(false),
  })
  .default({
    title: "",
    minutes: 0,
    done: false,
  });

export const PlanDaySchema = z
  .object({
    day: z.number().int().min(1).max(7).default(1),
    focus: z.string().default(""),
    tasks: z.array(PlanTaskSchema).default([]),
  })
  .default({
    day: 1,
    focus: "",
    tasks: [],
  });

export const AnalysisSchema = z
  .object({
    summary: z.string().default(""),
    errors: z.array(AnalysisErrorSchema).default([]),
    nextBestActions: z.array(NextBestActionSchema).default([]),
    plan7d: z.array(PlanDaySchema).default([]),
  })
  .default({
    summary: "",
    errors: [],
    nextBestActions: [],
    plan7d: [],
  });

export const AnalysisResponseSchema = z.object({
  ok: z.literal(true).default(true),
  analysis: AnalysisSchema.default({}),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;
export type AnalysisErrorType = z.infer<typeof ErrorTypeSchema>;
