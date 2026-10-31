import { z } from "zod";
import { CARD_STATUSES, SIDE_FIELDS } from "@lib/types";

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

/**
 * Shape-only validation. Semantic rules (both sides non-empty, no overlap)
 * live in `validateConfig` so every entry point shares them.
 */
export const studyConfigSchema = z.object({
  sideA: z.array(z.enum(SIDE_FIELDS)),
  sideB: z.array(z.enum(SIDE_FIELDS)),
  categories: z.array(z.string()).nullable(),
  statuses: z.array(z.enum(CARD_STATUSES)),
});

export const sessionUpdateSchema = z.object({
  config: studyConfigSchema,
});

export const templateCreateSchema = z.object({
  name: z.string(),
  config: studyConfigSchema,
});

export const templateUpdateSchema = z.object({
  name: z.string().optional(),
  config: studyConfigSchema.optional(),
});
