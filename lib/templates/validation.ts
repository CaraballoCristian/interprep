import type { StudyConfig } from "../study/types";
import {
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  SIDE_FIELDS,
  type CardStatus,
  type SideField,
} from "../types";

/** Maximum length of a template name, after trimming. */
export const TEMPLATE_NAME_MAX_LENGTH = 80;

export type ConfigValidation =
  | { ok: true; config: StudyConfig }
  | { ok: false; error: "sides_required" | "sides_overlap" };

export type NameValidation =
  | { ok: true; name: string }
  | { ok: false; error: "empty_name" | "name_too_long" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps valid, unique side fields in their original order. */
export function sanitizeSide(value: unknown): SideField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<SideField>();
  const side: SideField[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    if (!(SIDE_FIELDS as readonly string[]).includes(item)) {
      continue;
    }

    const field = item as SideField;
    if (!seen.has(field)) {
      seen.add(field);
      side.push(field);
    }
  }

  return side;
}

/**
 * Missing statuses default to NEW/EASY/HARD (LEARNED is opt-in). An explicit
 * empty array means "no statuses" and is kept as-is.
 */
export function sanitizeStatuses(value: unknown): CardStatus[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CARD_STATUSES];
  }

  const selected = new Set(
    value.filter((item): item is CardStatus =>
      (CARD_STATUSES as readonly string[]).includes(item as string),
    ),
  );

  return CARD_STATUSES.filter((status) => selected.has(status));
}

/**
 * `null`/missing means "all categories" (dynamic). An explicit empty array
 * means "no categories". Empty strings are kept because a card may have no
 * category; the UI labels them as "Sin categoría".
 */
export function sanitizeCategories(value: unknown): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const category = item.trim();
    if (!seen.has(category)) {
      seen.add(category);
      categories.push(category);
    }
  }

  return categories;
}

/** Normalizes an unknown value into a structurally valid config shape. */
export function normalizeConfig(value: unknown): StudyConfig {
  const input = isRecord(value) ? value : {};

  return {
    sideA: sanitizeSide(input.sideA),
    sideB: sanitizeSide(input.sideB),
    categories: sanitizeCategories(input.categories),
    statuses: sanitizeStatuses(input.statuses),
    continuous: input.continuous === true,
  };
}

/**
 * Normalizes a config and enforces the two semantic rules: both sides must
 * have at least one field and a field cannot be on both sides.
 */
export function validateConfig(value: unknown): ConfigValidation {
  const config = normalizeConfig(value);

  if (config.sideA.length === 0 || config.sideB.length === 0) {
    return { ok: false, error: "sides_required" };
  }

  const overlap = config.sideA.some((field) => config.sideB.includes(field));
  if (overlap) {
    return { ok: false, error: "sides_overlap" };
  }

  return { ok: true, config };
}

/** Trims and collapses internal whitespace in a template name. */
export function sanitizeTemplateName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function validateTemplateName(value: unknown): NameValidation {
  const name = sanitizeTemplateName(value);

  if (name === "") {
    return { ok: false, error: "empty_name" };
  }

  if (name.length > TEMPLATE_NAME_MAX_LENGTH) {
    return { ok: false, error: "name_too_long" };
  }

  return { ok: true, name };
}
