import type { CardResult } from "../types";
import { HISTORY_LIMIT } from "./deck";
import type { StudyCard } from "./types";

/**
 * Applies a success/failure to a card: appends to history (keeping the last
 * 10) and increments the matching counter.
 */
export function applyResultToCard(
  card: StudyCard,
  result: CardResult,
): StudyCard {
  return {
    ...card,
    history: [...card.history, result].slice(-HISTORY_LIMIT),
    totalSuccess: card.totalSuccess + (result === "s" ? 1 : 0),
    totalFail: card.totalFail + (result === "f" ? 1 : 0),
  };
}

/**
 * Snapshot of everything an undo may need to restore. Taking a snapshot
 * (instead of decrementing counters) keeps undo exact even when the history
 * was truncated.
 */
export type CardSnapshot = Pick<
  StudyCard,
  "id" | "history" | "totalSuccess" | "totalFail" | "status" | "hidden"
>;

export function snapshotCard(card: StudyCard): CardSnapshot {
  return {
    id: card.id,
    history: [...card.history],
    totalSuccess: card.totalSuccess,
    totalFail: card.totalFail,
    status: card.status,
    hidden: card.hidden,
  };
}

export function restoreCard(
  card: StudyCard,
  snapshot: CardSnapshot,
): StudyCard {
  return {
    ...card,
    ...snapshot,
    history: [...snapshot.history],
  };
}
