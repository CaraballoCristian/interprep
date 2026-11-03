import { DEFAULT_DECK_NAME, type DeckSummary } from "@lib/decks/types";
import { validateDeckName } from "@lib/decks/validation";
import type { StudyConfig } from "@lib/study/types";
import {
  countDecks,
  createDeck,
  deleteDeck,
  findDeckByName,
  getDeckById,
  getDeckCardCount,
  listDeckSummaries,
  listDecks,
  renameDeck,
} from "@/db/repositories/decks";

export type DeckErrorCode =
  | "invalid_name"
  | "duplicate_name"
  | "not_found"
  | "empty_update"
  | "last_deck";

export class DeckError extends Error {
  readonly code: DeckErrorCode;

  constructor(code: DeckErrorCode) {
    super(code);
    this.name = "DeckError";
    this.code = code;
  }
}

export type DeleteDeckResult = {
  deletedCards: number;
};

export function listDeckViews(): DeckSummary[] {
  return listDeckSummaries();
}

function requireName(value: unknown): string {
  const result = validateDeckName(value);
  if (!result.ok) {
    throw new DeckError("invalid_name");
  }
  return result.name;
}

/** Seeds the default deck when the database has none. Idempotent. */
export function ensureDefaultDeck(): void {
  if (countDecks() > 0) {
    return;
  }

  createDeck(DEFAULT_DECK_NAME);
}

export function createDeckFromInput(input: unknown): DeckSummary {
  const name = requireName(
    typeof input === "object" && input !== null && "name" in input
      ? (input as { name: unknown }).name
      : undefined,
  );

  if (findDeckByName(name)) {
    throw new DeckError("duplicate_name");
  }

  const deck = createDeck(name);
  return { ...deck, cardCount: 0 };
}

export function renameDeckFromInput(
  id: string,
  input: unknown,
): DeckSummary {
  if (!getDeckById(id)) {
    throw new DeckError("not_found");
  }

  if (
    typeof input !== "object" ||
    input === null ||
    !("name" in input)
  ) {
    throw new DeckError("empty_update");
  }

  const name = requireName((input as { name: unknown }).name);
  if (findDeckByName(name, id)) {
    throw new DeckError("duplicate_name");
  }

  const updated = renameDeck(id, name);
  if (!updated) {
    throw new DeckError("not_found");
  }

  return { ...updated, cardCount: getDeckCardCount(id) };
}

/**
 * Deletes a deck and every card in it. The last deck cannot be removed: the
 * app always needs a destination for new cards and imports.
 */
export function removeDeck(id: string): DeleteDeckResult {
  if (!getDeckById(id)) {
    throw new DeckError("not_found");
  }

  if (countDecks() <= 1) {
    throw new DeckError("last_deck");
  }

  const deletedCards = getDeckCardCount(id);
  deleteDeck(id);
  return { deletedCards };
}

/**
 * Resolves a deck id from an optional input. Missing values fall back to the
 * first deck (creating the default one if the table is empty), which keeps old
 * clients working while the UI always sends an explicit deck.
 */
export function resolveDeckId(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    const id = value.trim();
    if (!getDeckById(id)) {
      throw new DeckError("not_found");
    }
    return id;
  }

  ensureDefaultDeck();
  const first = listDecks()[0];
  if (!first) {
    throw new DeckError("not_found");
  }
  return first.id;
}

/** Removes deck ids that no longer exist from a config. */
export function pruneConfigDecks(
  config: StudyConfig,
  existingIds: ReadonlySet<string> = new Set(
    listDecks().map((deck) => deck.id),
  ),
): StudyConfig {
  if (config.deckIds === null) {
    return config;
  }

  const deckIds = config.deckIds.filter((id) => existingIds.has(id));
  if (deckIds.length === config.deckIds.length) {
    return config;
  }

  return { ...config, deckIds };
}

/** Union of the categories present in the selected decks. */
export function categoriesForDecks(
  deckIds: readonly string[] | null,
  categoriesByDeck: Readonly<Record<string, string[]>>,
  allDeckIds: readonly string[],
): string[] {
  const selected = deckIds === null ? allDeckIds : deckIds;
  const categories = new Set<string>();

  for (const deckId of selected) {
    for (const category of categoriesByDeck[deckId] ?? []) {
      categories.add(category);
    }
  }

  return [...categories].sort((a, b) => a.localeCompare(b, "es"));
}
