import { z } from "zod";

const columnIndex = z.number().int().min(0).nullable();

export const importMappingSchema = z.object({
  termEng: columnIndex.optional(),
  termEsp: columnIndex.optional(),
  category: columnIndex.optional(),
  status: columnIndex.optional(),
  description: columnIndex.optional(),
});

export const importRequestSchema = z.object({
  content: z.string().min(1).max(5_000_000),
  mapping: importMappingSchema.optional(),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;
