import { z } from "zod";
import {
  MAX_SILENCE_SECONDS,
  MIN_SILENCE_SECONDS,
} from "@lib/dictation/config";
import {
  DICTATION_DIRECTIONS,
  DICTATION_LENGTHS,
  DICTATION_SPEEDS,
} from "@lib/dictation/types";
import { CARD_STATUSES, LANGUAGES, SIDE_FIELDS, THEMES } from "@lib/types";

const columnIndex = z.number().int().min(0).nullable();

export const importMappingSchema = z.object({
  termEng: columnIndex.optional(),
  termEsp: columnIndex.optional(),
  category: columnIndex.optional(),
  description: columnIndex.optional(),
});

export const importRequestSchema = z.object({
  content: z.string().min(1).max(5_000_000),
  mapping: importMappingSchema.optional(),
  /** 1-based header row. Omitted means "detect it automatically". */
  headerRow: z.number().int().min(1).max(100_000).optional(),
  /** Target deck. Omitted means the first deck (legacy clients). */
  deckId: z.string().min(1).optional(),
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
  deckIds: z.array(z.string()).nullable(),
  statuses: z.array(z.enum(CARD_STATUSES)),
  continuous: z.boolean(),
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
  deckId: z.string().min(1).optional(),
  termEng: z.string().optional(),
  termEsp: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(CARD_STATUSES).optional(),
});

export const cardUpdateSchema = cardCreateSchema.extend({
  hidden: z.boolean().optional(),
});

export const deckCreateSchema = z.object({
  name: z.string(),
});

export const deckUpdateSchema = z.object({
  name: z.string().optional(),
});

export const exportFormatSchema = z.enum(["csv", "json"]);

/** Partial preferences update. Unknown keys are stripped by Zod. */
export const settingsUpdateSchema = z.object({
  theme: z.enum(THEMES).optional(),
  language: z.enum(LANGUAGES).optional(),
});

/**
 * Shape-only validation for Dictado. Semantic rules (eligible terms, category
 * warnings) live in the pure domain.
 */
export const dictationConfigSchema = z.object({
  categories: z.array(z.string().max(200)).max(500).nullable(),
  includeGeneral: z.boolean(),
  statuses: z.array(z.enum(CARD_STATUSES)).max(CARD_STATUSES.length),
  direction: z.enum(DICTATION_DIRECTIONS),
  length: z.enum(DICTATION_LENGTHS),
  autoplay: z.boolean(),
  listenMode: z.boolean(),
  speed: z.enum(DICTATION_SPEEDS),
  silenceSeconds: z
    .number()
    .int()
    .min(MIN_SILENCE_SECONDS)
    .max(MAX_SILENCE_SECONDS),
});

export const dictationGenerateSchema = z.object({
  config: dictationConfigSchema,
});

export const dictationKeySchema = z.object({
  apiKey: z.string().trim().min(10).max(300),
});
