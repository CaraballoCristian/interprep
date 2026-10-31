import type { CardStatus } from "../types";
import type { ImportRow } from "./preview";

export type ExistingCard = {
  id: string;
  matchKey: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
};

export type CardInsert = {
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
  matchKey: string;
};

export type CardUpdate = {
  id: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
};

export type ImportPlan = {
  inserts: CardInsert[];
  updates: CardUpdate[];
  /** Matched existing cards whose editable fields are identical. */
  unchanged: number;
  /** Existing cards that are not present in the file (kept untouched). */
  preserved: number;
  /** Rows that repeat a key already seen in the file (last one wins). */
  duplicateRows: number;
  /** Distinct valid cards in the file. */
  validRows: number;
};

/**
 * Builds the merge plan for an import/reimport. Matching is done by the
 * normalized key of termEng + termEsp. Status, hidden flag, history and
 * counters are never touched for existing cards.
 */
export function buildImportPlan(
  rows: readonly ImportRow[],
  existing: readonly ExistingCard[],
): ImportPlan {
  const unique = new Map<string, ImportRow>();
  let duplicateRows = 0;

  for (const row of rows) {
    if (unique.has(row.matchKey)) {
      duplicateRows += 1;
    }
    unique.set(row.matchKey, row);
  }

  const existingByKey = new Map(
    existing.map((card) => [card.matchKey, card]),
  );

  const inserts: CardInsert[] = [];
  const updates: CardUpdate[] = [];
  let unchanged = 0;

  for (const row of unique.values()) {
    const current = existingByKey.get(row.matchKey);

    if (!current) {
      inserts.push({
        termEng: row.termEng,
        termEsp: row.termEsp,
        category: row.category,
        description: row.description,
        status: row.status,
        matchKey: row.matchKey,
      });
      continue;
    }

    const changed =
      current.termEng !== row.termEng ||
      current.termEsp !== row.termEsp ||
      current.category !== row.category ||
      current.description !== row.description;

    if (changed) {
      updates.push({
        id: current.id,
        termEng: row.termEng,
        termEsp: row.termEsp,
        category: row.category,
        description: row.description,
      });
    } else {
      unchanged += 1;
    }
  }

  const preserved = existing.filter(
    (card) => !unique.has(card.matchKey),
  ).length;

  return {
    inserts,
    updates,
    unchanged,
    preserved,
    duplicateRows,
    validRows: unique.size,
  };
}
