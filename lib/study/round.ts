import type { CardResult } from "../types";
import { weightedShuffle } from "./deck";
import type { StudyCard } from "./types";

export type RoundState = {
  /** Card ids in round order (fixed for the whole round). */
  order: string[];
  /** Index of the current card in `order`. */
  index: number;
  /** Result per card resolved in this round. */
  results: Record<string, CardResult>;
  /** Card ids already resolved in this round, in order. */
  seen: string[];
  /** Card ids failed in this round, in order. */
  failed: string[];
};

export type RoundSummary = {
  seen: number;
  successes: number;
  failures: number;
  /** 0..1. Zero when no card was seen. */
  accuracy: number;
};

/**
 * Starts a round: every deck card appears exactly once, in weighted random
 * order computed up front.
 */
export function createRound(
  cards: readonly StudyCard[],
  random: () => number = Math.random,
): RoundState {
  return {
    order: weightedShuffle(cards, random).map((card) => card.id),
    index: 0,
    results: {},
    seen: [],
    failed: [],
  };
}

export function currentCardId(round: RoundState): string | null {
  return round.index < round.order.length ? round.order[round.index] : null;
}

export function isRoundComplete(round: RoundState): boolean {
  return currentCardId(round) === null;
}

/**
 * Records the result of the current card and advances. Results for any other
 * card are ignored (only the card being shown can be resolved).
 */
export function recordRoundResult(
  round: RoundState,
  cardId: string,
  result: CardResult,
): RoundState {
  if (currentCardId(round) !== cardId) {
    return round;
  }

  const failed =
    result === "f" && !round.failed.includes(cardId)
      ? [...round.failed, cardId]
      : round.failed;

  return {
    ...round,
    index: round.index + 1,
    results: { ...round.results, [cardId]: result },
    seen: [...round.seen, cardId],
    failed,
  };
}

/**
 * Removes the current card from the remaining order (e.g. it left the deck
 * because its status changed). The index now points to the next card.
 */
export function removeCurrentFromRound(round: RoundState): RoundState {
  if (currentCardId(round) === null) {
    return round;
  }

  return {
    ...round,
    order: [
      ...round.order.slice(0, round.index),
      ...round.order.slice(round.index + 1),
    ],
  };
}

export function summarizeRound(round: RoundState): RoundSummary {
  const results = round.seen
    .map((id) => round.results[id])
    .filter((result): result is CardResult => result !== undefined);

  const successes = results.filter((result) => result === "s").length;
  const failures = results.filter((result) => result === "f").length;
  const seen = results.length;

  return {
    seen,
    successes,
    failures,
    accuracy: seen === 0 ? 0 : successes / seen,
  };
}

/**
 * Builds a new round containing only the cards failed in the previous round.
 */
export function createReviewRound(
  cards: readonly StudyCard[],
  failedIds: readonly string[],
  random: () => number = Math.random,
): RoundState {
  const failed = new Set(failedIds);
  return createRound(
    cards.filter((card) => failed.has(card.id)),
    random,
  );
}
