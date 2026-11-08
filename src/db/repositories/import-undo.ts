import { and, eq, inArray } from "drizzle-orm";
import type {
  ImportUndoData,
  ImportUndoSummary,
} from "@lib/import/undo";
import { getDb } from "../client";
import { cards, decks, importUndo } from "../schema";

const CHUNK_SIZE = 200;

export type ImportUndoRecord = {
  id: string;
  deckId: string;
  deckName: string;
  data: ImportUndoData;
  createdAt: string;
};

/** Latest import snapshot for a user, joined with the current deck name. */
export function getImportUndo(userId: string): ImportUndoRecord | null {
  const row = getDb()
    .select({
      id: importUndo.id,
      deckId: importUndo.deckId,
      deckName: decks.name,
      data: importUndo.data,
      createdAt: importUndo.createdAt,
    })
    .from(importUndo)
    .innerJoin(
      decks,
      and(eq(decks.id, importUndo.deckId), eq(decks.userId, userId)),
    )
    .where(eq(importUndo.userId, userId))
    .get();

  return row ?? null;
}

export function summarizeImportUndo(
  record: ImportUndoRecord,
): ImportUndoSummary {
  return {
    deckId: record.deckId,
    deckName: record.deckName,
    inserted: record.data.insertedIds.length,
    updated: record.data.updates.length,
    createdAt: record.createdAt,
  };
}

export function getImportUndoSummary(
  userId: string,
): ImportUndoSummary | null {
  const record = getImportUndo(userId);
  return record ? summarizeImportUndo(record) : null;
}

export type ApplyImportUndoResult = {
  deleted: number;
  restored: number;
};

/**
 * Rolls back the snapshot in one transaction: removes the cards the import
 * created and restores the previous content of the cards it updated.
 */
export function applyImportUndo(
  userId: string,
  record: ImportUndoRecord,
): ApplyImportUndoResult {
  const db = getDb();
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    let deleted = 0;

    for (let i = 0; i < record.data.insertedIds.length; i += CHUNK_SIZE) {
      const chunk = record.data.insertedIds.slice(i, i + CHUNK_SIZE);
      const result = tx
        .delete(cards)
        .where(and(eq(cards.userId, userId), inArray(cards.id, chunk)))
        .run();
      deleted += result.changes;
    }

    let restored = 0;

    for (const update of record.data.updates) {
      const result = tx
        .update(cards)
        .set({
          termEng: update.termEng,
          termEsp: update.termEsp,
          category: update.category,
          description: update.description,
          matchKey: update.matchKey,
          updatedAt: now,
        })
        .where(and(eq(cards.userId, userId), eq(cards.id, update.id)))
        .run();
      restored += result.changes;
    }

    tx.delete(importUndo)
      .where(
        and(
          eq(importUndo.userId, userId),
          eq(importUndo.id, record.id),
        ),
      )
      .run();

    return { deleted, restored };
  });
}
