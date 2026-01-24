import { z } from "zod";

export const BotMessageSchema = z.object({
  message: z.string().min(1),
});

export const FeatureHelperResponseSchema = z.object({
  reply: z.string(),
  suggestedActions: z
    .array(z.object({ label: z.string(), href: z.string() }))
    .default([]),
});

export const EiBotRequestSchema = z.object({
  message: z.string().min(1),
  context: z.record(z.string(), z.any()).optional(),
});

export const EiBotResponseSchema = z.object({
  insights: z.array(z.string()),
  controllableFactors: z.array(z.string()),
  uncontrollableFactors: z.array(z.string()),
  nextSteps: z.array(z.string()),
  frictionSignals: z.array(z.string()).optional(),
});
