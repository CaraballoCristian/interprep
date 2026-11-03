import { snapshotCard, type CardSnapshot } from "./history";
import { cloneRound, type RoundState } from "./round";
import type { StudyCard } from "./types";

/** Maximum number of undoable actions kept in the session. */
export const UNDO_LIMIT = 20;

export type UndoKind = "status" | "hide";

export type UndoEntry = {
  kind: UndoKind;
  cardId: string;
  /** State of the card before the action. */
  snapshot: CardSnapshot;
  /** Timestamp (ms) when the action happened. */
  at: number;
};

/** Everything needed to step back one action. */
export type SessionUndo = {
  entry: UndoEntry;
  /** Round state before the undoable action. */
  round: RoundState;
  flipped: boolean;
  revealed: boolean;
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
  };
}

export function createSessionUndo(
  kind: UndoKind,
  card: StudyCard,
  round: RoundState,
  flipped: boolean,
  revealed: boolean,
  at: number,
): SessionUndo {
  return {
    entry: createUndoEntry(kind, card, at),
    round: cloneRound(round),
    flipped,
    revealed,
  };
}

/** Appends an action and keeps only the last `UNDO_LIMIT` entries. */
export function pushUndo(
  stack: readonly SessionUndo[],
  entry: SessionUndo,
): SessionUndo[] {
  return [...stack, entry].slice(-UNDO_LIMIT);
}

export function undoAvailable(stack: readonly SessionUndo[]): boolean {
  return stack.length > 0;
}
