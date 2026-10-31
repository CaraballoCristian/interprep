import { snapshotCard, type CardSnapshot } from "./history";
import type { StudyCard } from "./types";

/** How long the undo button stays visible. */
export const UNDO_WINDOW_MS = 8_000;

/** The undo is hidden after this many additional cards are resolved. */
export const UNDO_MAX_RESOLUTIONS = 3;

export type UndoKind = "result" | "status" | "hide";

export type UndoEntry = {
  kind: UndoKind;
  cardId: string;
  /** State of the card before the action. */
  snapshot: CardSnapshot;
  /** Timestamp (ms) when the action happened. */
  at: number;
  /** Results resolved after this action. */
  resolutionsAfter: number;
};

export function createUndoEntry(
  kind: UndoKind,
  card: StudyCard,
  at: number,
): UndoEntry {
  return {
    kind,
    cardId: card.id,
    snapshot: snapshotCard(card),
    at,
    resolutionsAfter: 0,
  };
}

export function isUndoAvailable(
  entry: UndoEntry | null,
  now: number,
): boolean {
  if (!entry) {
    return false;
  }
  if (entry.resolutionsAfter >= UNDO_MAX_RESOLUTIONS) {
    return false;
  }
  return now - entry.at < UNDO_WINDOW_MS;
}

/**
 * Increments the counter of results resolved since the undoable action.
 */
export function markResolution(entry: UndoEntry | null): UndoEntry | null {
  if (!entry) {
    return null;
  }
  return { ...entry, resolutionsAfter: entry.resolutionsAfter + 1 };
}
