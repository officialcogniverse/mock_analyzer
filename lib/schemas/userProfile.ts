import { z } from "zod";

export const ThemeSchema = z.enum(["light", "dark", "system"]);

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().nullable().optional(),
  email: z.string().email(),
  provider: z.string().optional(),
  examGoal: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  weeklyHours: z.number().int().min(0).nullable().optional(),
  baselineLevel: z.string().nullable().optional(),
  preferences: z.object({ theme: ThemeSchema }).default({ theme: "system" }),
  onboardingCompleted: z.boolean().default(false),
  deletedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
