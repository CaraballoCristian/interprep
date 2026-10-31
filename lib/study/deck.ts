import type { CardResult } from "../types";
import type { StudyCard, StudyConfig } from "./types";

/** Number of results kept per card. */
export const HISTORY_LIMIT = 10;

/**
 * Weight used for the round order: 1 + number of failures in the last 10
 * results.
 */
export function cardWeight(card: Pick<StudyCard, "history">): number {
  const recent = card.history.slice(-HISTORY_LIMIT);
  return 1 + recent.filter((result) => result === "f").length;
}

/**
 * A card belongs to the deck when it is not hidden, its status is selected
 * and its category is selected (or all categories are selected).
 */
export function buildDeck(
  cards: readonly StudyCard[],
  config: Pick<StudyConfig, "categories" | "statuses">,
): StudyCard[] {
  return cards.filter(
    (card) =>
      !card.hidden &&
      config.statuses.includes(card.status) &&
      (config.categories === null ||
        config.categories.includes(card.category)),
  );
}

/**
 * Weighted random order without replacement (Efraimidis–Spirakis):
 * key = random()^(1 / weight), sorted descending. Cards with more failures
 * tend to appear earlier.
 */
export function weightedShuffle<T extends { history: CardResult[] }>(
  cards: readonly T[],
  random: () => number = Math.random,
): T[] {
  return cards
    .map((card) => ({
      card,
      key: Math.pow(random(), 1 / cardWeight(card)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.card);
}
