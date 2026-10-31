import { eq, sql } from "drizzle-orm";
import type {
  CardInsert,
  CardUpdate,
  ExistingCard,
} from "@lib/import/plan";
import type { CardSnapshot } from "@lib/study/history";
import type { StudyCard } from "@lib/study/types";
import type { CardResult, CardStatus } from "@lib/types";
import { getDb } from "../client";
import { cards } from "../schema";

const INSERT_CHUNK_SIZE = 200;

export function countCards(): number {
  const row = getDb()
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .get();
  return row?.count ?? 0;
}

/** Lightweight projection used by the importer to match existing cards. */
export function listCardsForMatching(): ExistingCard[] {
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
    .all();
}

export type ApplyImportResult = {
  inserted: number;
  updated: number;
};

/**
 * Applies an import plan atomically. New cards get default status/history
 * values; existing cards keep status, hidden flag, history and counters.
 */
export function applyImportPlan(plan: {
  inserts: readonly CardInsert[];
  updates: readonly CardUpdate[];
}): ApplyImportResult {
  const db = getDb();
  const now = new Date().toISOString();

  db.transaction((tx) => {
    for (let i = 0; i < plan.inserts.length; i += INSERT_CHUNK_SIZE) {
      const chunk = plan.inserts
        .slice(i, i + INSERT_CHUNK_SIZE)
        .map((card) => ({
          id: crypto.randomUUID(),
          category: card.category,
          termEng: card.termEng,
          termEsp: card.termEsp,
          description: card.description,
          status: card.status,
          hidden: false,
          history: [] as CardResult[],
          totalSuccess: 0,
          totalFail: 0,
          matchKey: card.matchKey,
          createdAt: now,
          updatedAt: now,
        }));

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
        .where(eq(cards.id, update.id))
        .run();
    }
  });

  return { inserted: plan.inserts.length, updated: plan.updates.length };
}

const studyCardColumns = {
  id: cards.id,
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

export function listStudyCards(): StudyCard[] {
  return getDb().select(studyCardColumns).from(cards).all();
}

export function getStudyCard(id: string): StudyCard | null {
  const row = getDb()
    .select(studyCardColumns)
    .from(cards)
    .where(eq(cards.id, id))
    .get();
  return row ?? null;
}

export function updateCardResult(
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
    .where(eq(cards.id, id))
    .run();
}

export function updateCardStatus(id: string, status: CardStatus): void {
  getDb()
    .update(cards)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(cards.id, id))
    .run();
}

export function updateCardHidden(id: string, hidden: boolean): void {
  getDb()
    .update(cards)
    .set({ hidden, updatedAt: new Date().toISOString() })
    .where(eq(cards.id, id))
    .run();
}

/** Restores the fields captured by an undo snapshot. */
export function restoreCardFields(
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
    .where(eq(cards.id, id))
    .run();
}
