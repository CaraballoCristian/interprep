import { matchKey } from "../normalize";
import { scenarioCategories } from "./config";
import {
  DICTATION_TERMS_BY_LENGTH,
  GENERAL_CATEGORY,
  type DictationCard,
  type DictationConfig,
  type DictationTerm,
  type DictationWarning,
} from "./types";

export type TermSelectionError = "no_eligible_terms" | "not_enough_terms";

export type TermSelection =
  | {
      ok: true;
      scenarioCategory: string;
      terms: DictationTerm[];
      warnings: DictationWarning[];
    }
  | {
      ok: false;
      code: TermSelectionError;
      warnings: DictationWarning[];
      /** How many distinct eligible terms the selected pool had. */
      available: number;
      /** How many terms the chosen length requires. */
      required: number;
    };

function pick<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(
    items.length - 1,
    Math.max(0, Math.floor(random() * items.length)),
  );
  return items[index];
}

function pickMany<T>(
  items: readonly T[],
  count: number,
  random: () => number,
): T[] {
  const copy = [...items];

  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(random() * (copy.length - i));
    const swap = Math.min(copy.length - 1, Math.max(i, j));
    [copy[i], copy[swap]] = [copy[swap], copy[i]];
  }

  return copy.slice(0, count);
}

/** One card per normalized term pair, so a phrase never repeats a term. */
function dedupeCards(cards: readonly DictationCard[]): DictationCard[] {
  const seen = new Set<string>();
  const result: DictationCard[] = [];

  for (const card of cards) {
    const key = matchKey(card.termEng, card.termEsp);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(card);
  }

  return result;
}

function toTerm(card: DictationCard): DictationTerm {
  return {
    cardId: card.id,
    category: card.category,
    termEng: card.termEng,
    termEsp: card.termEsp,
  };
}

/**
 * Picks one scenario category and 3-5 terms from it plus General.
 *
 * Rules:
 * - hidden cards and statuses outside the config are never used;
 * - exactly one scenario category is chosen per phrase;
 * - General supplements the scenario but never mixes a second scenario;
 * - when no scenario category has terms, General alone can act as the
 *   scenario (useful for users who only keep a General category).
 */
export function selectDictationTerms(
  cards: readonly DictationCard[],
  config: DictationConfig,
  random: () => number = Math.random,
): TermSelection {
  const required = DICTATION_TERMS_BY_LENGTH[config.length];

  const eligible = dedupeCards(
    cards.filter(
      (card) =>
        !card.hidden &&
        config.statuses.includes(card.status) &&
        card.termEng.trim().length > 0 &&
        card.termEsp.trim().length > 0,
    ),
  );

  const groups = new Map<string, DictationCard[]>();
  for (const card of eligible) {
    const group = groups.get(card.category);
    if (group) {
      group.push(card);
    } else {
      groups.set(card.category, [card]);
    }
  }

  const general = config.includeGeneral
    ? groups.get(GENERAL_CATEGORY) ?? []
    : [];

  const knownCategories = [
    ...new Set(cards.map((card) => card.category)),
  ].filter((category) => category !== GENERAL_CATEGORY);

  const selectedCategories = scenarioCategories(config, knownCategories);

  const warnings: DictationWarning[] = selectedCategories
    .filter((category) => (groups.get(category)?.length ?? 0) === 0)
    .map((category) => ({ code: "category_empty", category }));

  const eligibleScenarioCategories = selectedCategories.filter(
    (category) => (groups.get(category)?.length ?? 0) > 0,
  );

  const generalOnly =
    config.includeGeneral &&
    eligibleScenarioCategories.length === 0 &&
    general.length > 0;

  if (eligibleScenarioCategories.length === 0 && !generalOnly) {
    return {
      ok: false,
      code: "no_eligible_terms",
      warnings,
      available: 0,
      required,
    };
  }

  const scenarioCategory = generalOnly
    ? GENERAL_CATEGORY
    : pick(eligibleScenarioCategories, random);

  const scenarioCards =
    scenarioCategory === GENERAL_CATEGORY
      ? general
      : groups.get(scenarioCategory) ?? [];

  const pool = dedupeCards(
    scenarioCategory === GENERAL_CATEGORY
      ? scenarioCards
      : [...scenarioCards, ...general],
  );

  if (pool.length < required) {
    return {
      ok: false,
      code: "not_enough_terms",
      warnings,
      available: pool.length,
      required,
    };
  }

  if (config.includeGeneral && general.length === 0) {
    warnings.push({ code: "general_empty" });
  }

  return {
    ok: true,
    scenarioCategory,
    terms: pickMany(pool, required, random).map(toTerm),
    warnings,
  };
}
