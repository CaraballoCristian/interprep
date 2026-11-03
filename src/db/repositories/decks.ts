import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { DeckSummary } from "@lib/decks/types";
import { getDb } from "../client";
import { cards, decks, type Deck } from "../schema";

export function listDecks(): Deck[] {
  return getDb()
    .select()
    .from(decks)
    .orderBy(asc(decks.createdAt), asc(decks.name))
    .all();
}

export function listDeckSummaries(): DeckSummary[] {
  return getDb()
    .select({
      id: decks.id,
      name: decks.name,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
      cardCount: sql<number>`count(${cards.id})`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .groupBy(decks.id)
    .orderBy(asc(decks.createdAt), asc(decks.name))
    .all();
}

export function getDeckById(id: string): Deck | null {
  const row = getDb()
    .select()
    .from(decks)
    .where(eq(decks.id, id))
    .get();
  return row ?? null;
}

/**
 * Finds a deck by name, case-insensitively. `excludeId` is used when renaming
 * so a deck does not collide with itself.
 */
export function findDeckByName(
  name: string,
  excludeId?: string,
): Deck | null {
  const matchesName = sql`lower(${decks.name}) = lower(${name})`;
  const where = excludeId
    ? and(matchesName, ne(decks.id, excludeId))
    : matchesName;

  const row = getDb().select().from(decks).where(where).get();
  return row ?? null;
}

export function countDecks(): number {
  const row = getDb()
    .select({ count: sql<number>`count(*)` })
    .from(decks)
    .get();
  return row?.count ?? 0;
}

export function getDeckCardCount(id: string): number {
  const row = getDb()
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .where(eq(cards.deckId, id))
    .get();
  return row?.count ?? 0;
}

export function createDeck(name: string): Deck {
  const now = new Date().toISOString();

  return getDb()
    .insert(decks)
    .values({
      id: crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function renameDeck(id: string, name: string): Deck | null {
  const row = getDb()
    .update(decks)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(decks.id, id))
    .returning()
    .get();

  return row ?? null;
}

/** Returns false when the deck did not exist. Cards are removed by cascade. */
export function deleteDeck(id: string): boolean {
  const result = getDb().delete(decks).where(eq(decks.id, id)).run();
  return result.changes > 0;
}

/**
 * Distinct categories per deck. Decks without cards are not present in the
 * map, so callers should fall back to an empty array.
 */
export function listCategoriesByDeck(): Record<string, string[]> {
  const rows = getDb()
    .selectDistinct({
      deckId: cards.deckId,
      category: cards.category,
    })
    .from(cards)
    .all();

  const result: Record<string, string[]> = {};

  for (const row of rows) {
    (result[row.deckId] ??= []).push(row.category);
  }

  for (const categories of Object.values(result)) {
    categories.sort((a, b) => a.localeCompare(b, "es"));
  }

  return result;
}
