import { z } from "zod";

export const UploadSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(["pdf", "text", "image"]),
  filename: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  size: z.number().int().nullable().optional(),
  createdAt: z.string().datetime(),
  extractedText: z.string().nullable().optional(),
  extractionMeta: z.record(z.string(), z.any()).nullable().optional(),
  storageRef: z.string().nullable().optional(),
});

export type UploadDoc = z.infer<typeof UploadSchema>;
