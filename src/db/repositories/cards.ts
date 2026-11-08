import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type {
  DictationCard,
  DictationCategoryInfo,
} from "@lib/dictation/types";
import type {
  CardInsert,
  CardUpdate,
  ExistingCard,
} from "@lib/import/plan";
import type { ImportUndoData } from "@lib/import/undo";
import type { LibraryCard } from "@lib/library/types";
import { matchKey as buildMatchKey } from "@lib/normalize";
import type { CardSnapshot } from "@lib/study/history";
import type { StudyCard } from "@lib/study/types";
import type { CardResult, CardStatus } from "@lib/types";
import { getDb } from "../client";
import { cards, importUndo } from "../schema";

const INSERT_CHUNK_SIZE = 200;

/**
 * `null`/undefined counts every deck. An empty array means no decks and
 * therefore zero cards.
 */
export function countCards(
  userId: string,
  deckIds?: readonly string[] | null,
): number {
  if (deckIds && deckIds.length === 0) {
    return 0;
  }

  const query = getDb()
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .where(
      deckIds
        ? and(
            eq(cards.userId, userId),
            inArray(cards.deckId, [...deckIds]),
          )
        : eq(cards.userId, userId),
    );
  const row = query.get();
  return row?.count ?? 0;
}

/**
 * Distinct categories present in the selected decks, sorted for the filters
 * UI. The empty string is kept: imported cards without a category use it.
 */
export function listCategories(
  userId: string,
  deckIds?: readonly string[] | null,
): string[] {
  if (deckIds && deckIds.length === 0) {
    return [];
  }

  const rows = getDb()
    .selectDistinct({ category: cards.category })
    .from(cards)
    .where(
      deckIds
        ? and(
            eq(cards.userId, userId),
            inArray(cards.deckId, [...deckIds]),
          )
        : eq(cards.userId, userId),
    )
    .all();

  return rows
    .map((row) => row.category)
    .sort((a, b) => a.localeCompare(b, "es"));
}

/** Lightweight projection used by the importer to match existing cards. */
export function listCardsForMatching(
  userId: string,
  deckId: string,
): ExistingCard[] {
  return getDb()
    .select({
      id: cards.id,
      matchKey: cards.matchKey,
      termEng: cards.termEng,
      termEsp: cards.termEsp,
      category: cards.category,
      description: cards.description,
    })
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.deckId, deckId)))
    .all();
}

export type ApplyImportResult = {
  inserted: number;
  updated: number;
};

/**
 * Applies an import plan atomically. New cards get default status/history
 * values; existing cards keep status, hidden flag, history and counters.
 *
 * The previous content of every updated card and the ids of every inserted
 * card are stored as the user's single "undo import" snapshot. A new import
 * replaces the previous snapshot; an import that changes nothing leaves it
 * untouched.
 */
export function applyImportPlan(
  userId: string,
  plan: {
    inserts: readonly CardInsert[];
    updates: readonly CardUpdate[];
  },
  deckId: string,
): ApplyImportResult {
  const db = getDb();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    const updateIds = plan.updates.map((update) => update.id);
    const previous: ImportUndoData["updates"] = [];

    for (let i = 0; i < updateIds.length; i += INSERT_CHUNK_SIZE) {
      const chunk = updateIds.slice(i, i + INSERT_CHUNK_SIZE);
      const rows = tx
        .select({
          id: cards.id,
          termEng: cards.termEng,
          termEsp: cards.termEsp,
          category: cards.category,
          description: cards.description,
          matchKey: cards.matchKey,
        })
        .from(cards)
        .where(and(eq(cards.userId, userId), inArray(cards.id, chunk)))
        .all();

      previous.push(...rows);
    }

    const insertedIds: string[] = [];

    for (let i = 0; i < plan.inserts.length; i += INSERT_CHUNK_SIZE) {
      const chunk = plan.inserts
        .slice(i, i + INSERT_CHUNK_SIZE)
        .map((card) => {
          const id = crypto.randomUUID();
          insertedIds.push(id);

          return {
            id,
            userId,
            deckId,
            category: card.category,
            termEng: card.termEng,
            termEsp: card.termEsp,
            description: card.description,
            status: "new" as const,
            hidden: false,
            history: [] as CardResult[],
            totalSuccess: 0,
            totalFail: 0,
            matchKey: card.matchKey,
            createdAt: now,
            updatedAt: now,
          };
        });

      tx.insert(cards).values(chunk).run();
    }

    for (const update of plan.updates) {
      tx.update(cards)
        .set({
          termEng: update.termEng,
          termEsp: update.termEsp,
          category: update.category,
          description: update.description,
          updatedAt: now,
        })
        .where(and(eq(cards.userId, userId), eq(cards.id, update.id)))
        .run();
    }

    if (plan.inserts.length > 0 || plan.updates.length > 0) {
      tx.delete(importUndo)
        .where(eq(importUndo.userId, userId))
        .run();
      tx.insert(importUndo)
        .values({
          id: userId,
          userId,
          deckId,
          data: { insertedIds, updates: previous },
          createdAt: now,
        })
        .run();
    }
  });

  return { inserted: plan.inserts.length, updated: plan.updates.length };
}

const studyCardColumns = {
  id: cards.id,
  deckId: cards.deckId,
  category: cards.category,
  termEng: cards.termEng,
  termEsp: cards.termEsp,
  description: cards.description,
  status: cards.status,
  hidden: cards.hidden,
  history: cards.history,
  totalSuccess: cards.totalSuccess,
  totalFail: cards.totalFail,
};

export function listStudyCards(userId: string): StudyCard[] {
  return getDb()
    .select(studyCardColumns)
    .from(cards)
    .where(eq(cards.userId, userId))
    .all();
}

export function getStudyCard(
  userId: string,
  id: string,
): StudyCard | null {
  const row = getDb()
    .select(studyCardColumns)
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .get();
  return row ?? null;
}

export function updateCardResult(
  userId: string,
  id: string,
  result: {
    history: CardResult[];
    totalSuccess: number;
    totalFail: number;
  },
): void {
  getDb()
    .update(cards)
    .set({
      history: result.history,
      totalSuccess: result.totalSuccess,
      totalFail: result.totalFail,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
}

export function updateCardStatus(
  userId: string,
  id: string,
  status: CardStatus,
): void {
  getDb()
    .update(cards)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
}

/** Updates the study-related fields of a card in a single write. */
export function updateCardStudyFields(
  userId: string,
  id: string,
  input: {
    status: CardStatus;
    history: CardResult[];
    totalSuccess: number;
    totalFail: number;
  },
): void {
  getDb()
    .update(cards)
    .set({
      status: input.status,
      history: input.history,
      totalSuccess: input.totalSuccess,
      totalFail: input.totalFail,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
}

export function updateCardHidden(
  userId: string,
  id: string,
  hidden: boolean,
): void {
  getDb()
    .update(cards)
    .set({ hidden, updatedAt: new Date().toISOString() })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
}

/** Restores the fields captured by an undo snapshot. */
export function restoreCardFields(
  userId: string,
  id: string,
  snapshot: CardSnapshot,
): void {
  getDb()
    .update(cards)
    .set({
      history: snapshot.history,
      totalSuccess: snapshot.totalSuccess,
      totalFail: snapshot.totalFail,
      status: snapshot.status,
      hidden: snapshot.hidden,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
}

const libraryCardColumns = {
  id: cards.id,
  deckId: cards.deckId,
  termEng: cards.termEng,
  termEsp: cards.termEsp,
  category: cards.category,
  description: cards.description,
  status: cards.status,
  hidden: cards.hidden,
  history: cards.history,
  totalSuccess: cards.totalSuccess,
  totalFail: cards.totalFail,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
};

/** Every card, including hidden ones. Filtering happens in the pure domain. */
export function listLibraryCards(userId: string): LibraryCard[] {
  return getDb()
    .select(libraryCardColumns)
    .from(cards)
    .where(eq(cards.userId, userId))
    .all();
}

export function getCardById(
  userId: string,
  id: string,
): LibraryCard | null {
  const row = getDb()
    .select(libraryCardColumns)
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .get();
  return row ?? null;
}

/**
 * Finds a card with the same normalized term pair inside a deck. `excludeId`
 * lets an edit keep its own key without colliding with itself.
 */
export function findCardByMatchKey(
  userId: string,
  deckId: string,
  key: string,
  excludeId?: string,
): { id: string } | null {
  const where = excludeId
    ? and(
        eq(cards.userId, userId),
        eq(cards.deckId, deckId),
        eq(cards.matchKey, key),
        ne(cards.id, excludeId),
      )
    : and(
        eq(cards.userId, userId),
        eq(cards.deckId, deckId),
        eq(cards.matchKey, key),
      );

  const row = getDb()
    .select({ id: cards.id })
    .from(cards)
    .where(where)
    .get();

  return row ?? null;
}

export type LibraryCardInput = {
  deckId: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
};

/** Creates a card with empty history/counters and returns the stored row. */
export function createCard(
  userId: string,
  input: LibraryCardInput,
): LibraryCard {
  const now = new Date().toISOString();

  return getDb()
    .insert(cards)
    .values({
      id: crypto.randomUUID(),
      userId,
      deckId: input.deckId,
      category: input.category,
      termEng: input.termEng,
      termEsp: input.termEsp,
      description: input.description,
      status: input.status,
      hidden: false,
      history: [],
      totalSuccess: 0,
      totalFail: 0,
      matchKey: buildMatchKey(input.termEng, input.termEsp),
      createdAt: now,
      updatedAt: now,
    })
    .returning(libraryCardColumns)
    .get();
}

/** Updates editable content and recomputes the matching key. */
export function updateCard(
  userId: string,
  id: string,
  input: LibraryCardInput,
): LibraryCard | null {
  const row = getDb()
    .update(cards)
    .set({
      deckId: input.deckId,
      category: input.category,
      termEng: input.termEng,
      termEsp: input.termEsp,
      description: input.description,
      status: input.status,
      matchKey: buildMatchKey(input.termEng, input.termEsp),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .returning(libraryCardColumns)
    .get();

  return row ?? null;
}

/** Returns false when the card did not exist. */
export function deleteCard(userId: string, id: string): boolean {
  const result = getDb()
    .delete(cards)
    .where(and(eq(cards.userId, userId), eq(cards.id, id)))
    .run();
  return result.changes > 0;
}

/** Minimal projection used by Dictado; hidden cards are filtered in the domain. */
export function listDictationCards(userId: string): DictationCard[] {
  return getDb()
    .select({
      id: cards.id,
      category: cards.category,
      termEng: cards.termEng,
      termEsp: cards.termEsp,
      status: cards.status,
      hidden: cards.hidden,
    })
    .from(cards)
    .where(eq(cards.userId, userId))
    .all();
}

/**
 * Visible card counts per category and status. Categories with only hidden
 * cards still appear with total 0, so the UI can explain why they yield no
 * terms instead of silently hiding them.
 */
export function listDictationCategories(
  userId: string,
): DictationCategoryInfo[] {
  const rows = getDb()
    .select({
      category: cards.category,
      status: cards.status,
      hidden: cards.hidden,
      count: sql<number>`count(*)`,
    })
    .from(cards)
    .where(eq(cards.userId, userId))
    .groupBy(cards.category, cards.status, cards.hidden)
    .all();

  const byCategory = new Map<string, DictationCategoryInfo>();

  for (const row of rows) {
    const info = byCategory.get(row.category) ?? {
      name: row.category,
      total: 0,
      byStatus: { new: 0, easy: 0, hard: 0, learned: 0 },
    };

    if (!row.hidden) {
      info.total += row.count;
      info.byStatus[row.status] += row.count;
    }

    byCategory.set(row.category, info);
  }

  return [...byCategory.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}
