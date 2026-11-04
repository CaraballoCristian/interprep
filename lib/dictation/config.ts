import {
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  type CardStatus,
} from "../types";
import {
  DICTATION_DIRECTIONS,
  DICTATION_LENGTHS,
  DICTATION_SPEEDS,
  DICTATION_TERMS_BY_LENGTH,
  GENERAL_CATEGORY,
  type DictationConfig,
  type DictationDirection,
  type DictationLength,
  type DictationSpeed,
  type ResolvedDirection,
} from "./types";

export const MIN_SILENCE_SECONDS = 3;
export const MAX_SILENCE_SECONDS = 30;
export const DEFAULT_SILENCE_SECONDS = 5;

/**
 * Defaults chosen for a first round: English -> Spanish (the app's default
 * template), short phrases, autoplay on and listen mode off.
 */
export const DEFAULT_DICTATION_CONFIG: DictationConfig = {
  categories: null,
  includeGeneral: true,
  statuses: [...DEFAULT_CARD_STATUSES],
  direction: "en-es",
  length: "short",
  autoplay: true,
  listenMode: false,
  speed: "normal",
  silenceSeconds: DEFAULT_SILENCE_SECONDS,
};

function oneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

export function clampSilenceSeconds(value: number): number {
  return Math.min(
    MAX_SILENCE_SECONDS,
    Math.max(MIN_SILENCE_SECONDS, Math.round(value)),
  );
}

export function termCountForLength(length: DictationLength): number {
  return DICTATION_TERMS_BY_LENGTH[length];
}

/**
 * Coerces stored or submitted values into a safe configuration. Unknown
 * categories are dropped when `availableCategories` is provided; that keeps a
 * deleted category from staying selected forever.
 */
export function normalizeDictationConfig(
  raw: Partial<DictationConfig> | null | undefined,
  availableCategories?: readonly string[],
): DictationConfig {
  const source = raw ?? {};
  const available = availableCategories
    ? new Set(availableCategories)
    : null;

  let categories: string[] | null;
  if (source.categories === null) {
    categories = null;
  } else if (Array.isArray(source.categories)) {
    const seen = new Set<string>();
    categories = source.categories
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item !== GENERAL_CATEGORY)
      .filter((item) => !available || available.has(item))
      .filter((item) => {
        if (seen.has(item)) {
          return false;
        }
        seen.add(item);
        return true;
      });
  } else {
    categories = null;
  }

  const statuses: CardStatus[] = Array.isArray(source.statuses)
    ? CARD_STATUSES.filter((status) => source.statuses!.includes(status))
    : [...DEFAULT_CARD_STATUSES];

  return {
    categories,
    includeGeneral:
      typeof source.includeGeneral === "boolean"
        ? source.includeGeneral
        : DEFAULT_DICTATION_CONFIG.includeGeneral,
    statuses,
    direction: oneOf(DICTATION_DIRECTIONS, source.direction)
      ? source.direction
      : DEFAULT_DICTATION_CONFIG.direction,
    length: oneOf(DICTATION_LENGTHS, source.length)
      ? source.length
      : DEFAULT_DICTATION_CONFIG.length,
    autoplay:
      typeof source.autoplay === "boolean"
        ? source.autoplay
        : DEFAULT_DICTATION_CONFIG.autoplay,
    listenMode:
      typeof source.listenMode === "boolean"
        ? source.listenMode
        : DEFAULT_DICTATION_CONFIG.listenMode,
    speed: oneOf(DICTATION_SPEEDS, source.speed)
      ? source.speed
      : DEFAULT_DICTATION_CONFIG.speed,
    silenceSeconds:
      typeof source.silenceSeconds === "number" &&
      Number.isFinite(source.silenceSeconds)
        ? clampSilenceSeconds(source.silenceSeconds)
        : DEFAULT_DICTATION_CONFIG.silenceSeconds,
  };
}

/** Partial update that keeps the current value for omitted fields. */
export function mergeDictationConfig(
  current: DictationConfig,
  patch: Partial<DictationConfig>,
  availableCategories?: readonly string[],
): DictationConfig {
  const merged: Record<string, unknown> = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return normalizeDictationConfig(
    merged as Partial<DictationConfig>,
    availableCategories,
  );
}

/**
 * Scenario categories to draw from. `null` means every known category; General
 * never participates as a scenario when another category exists.
 */
export function scenarioCategories(
  config: Pick<DictationConfig, "categories">,
  availableCategories: readonly string[],
): string[] {
  const base =
    config.categories === null ? availableCategories : config.categories;
  const seen = new Set<string>();

  return base.filter((category) => {
    if (category === GENERAL_CATEGORY || seen.has(category)) {
      return false;
    }
    seen.add(category);
    return true;
  });
}

/** Kept as a single place to resolve the direction for a phrase. */
export function resolveDirection(
  direction: DictationDirection,
): ResolvedDirection {
  return direction;
}

/** Language spoken on each side. */
export function languageForSide(
  direction: ResolvedDirection,
  side: "A" | "B",
): "en" | "es" {
  const aIsEnglish = direction === "en-es";
  if (side === "A") {
    return aIsEnglish ? "en" : "es";
  }
  return aIsEnglish ? "es" : "en";
}

export type { DictationSpeed };
