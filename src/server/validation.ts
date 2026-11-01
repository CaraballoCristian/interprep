import { z } from "zod";
import { CARD_STATUSES, LANGUAGES, SIDE_FIELDS, THEMES } from "@lib/types";

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
  /** 1-based header row. Omitted means "detect it automatically". */
  headerRow: z.number().int().min(1).max(100_000).optional(),
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

/**
 * Shape-only validation for library cards. Semantic rules (required terms,
 * duplicate term pairs) live in the pure card validation and the service.
 */
export const cardCreateSchema = z.object({
  termEng: z.string().optional(),
  termEsp: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(CARD_STATUSES).optional(),
});

export const cardUpdateSchema = cardCreateSchema.extend({
  hidden: z.boolean().optional(),
});

export const exportFormatSchema = z.enum(["csv", "json"]);

/** Partial preferences update. Unknown keys are stripped by Zod. */
export const settingsUpdateSchema = z.object({
  theme: z.enum(THEMES).optional(),
  language: z.enum(LANGUAGES).optional(),
});
