import type { DictationEntry } from "./types";

export const DICTATION_HISTORY_LIMIT = 20;

export type DictationHistory = {
  entries: DictationEntry[];
  /** Index of the phrase currently shown. -1 when the session is empty. */
  index: number;
};

export function createDictationHistory(): DictationHistory {
  return { entries: [], index: -1 };
}

/**
 * Appends a phrase and drops the oldest one once the limit is reached. If the
 * user undid and then asks for a new phrase, the forward branch is discarded.
 */
export function pushDictationEntry(
  history: DictationHistory,
  entry: DictationEntry,
): DictationHistory {
  const entries =
    history.index >= 0 && history.index < history.entries.length - 1
      ? history.entries.slice(0, history.index + 1)
      : [...history.entries];

  entries.push(entry);

  const overflow = Math.max(0, entries.length - DICTATION_HISTORY_LIMIT);
  const trimmed = overflow > 0 ? entries.slice(overflow) : entries;

  return { entries: trimmed, index: trimmed.length - 1 };
}

/** Moves one phrase back. Returns the same history when there is no undo. */
export function undoDictationHistory(
  history: DictationHistory,
): DictationHistory {
  if (history.index <= 0) {
    return history;
  }
  return { ...history, index: history.index - 1 };
}

export function currentDictationEntry(
  history: DictationHistory,
): DictationEntry | null {
  if (history.index < 0 || history.index >= history.entries.length) {
    return null;
  }
  return history.entries[history.index];
}

export function canUndoDictation(history: DictationHistory): boolean {
  return history.index > 0;
}

/** Number of phrases available to undo. */
export function dictationUndoCount(history: DictationHistory): number {
  return Math.max(0, history.index);
}
