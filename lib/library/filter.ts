import { normalizeText } from "../normalize";
import { CARD_STATUSES, type CardStatus } from "../types";
import type { LibraryCard } from "./types";

export type HiddenFilter = "all" | "visible" | "hidden";

export type LibraryFilter = {
  search: string;
  /** null means all decks. */
  deckId: string | null;
  /** null means all categories. The empty string is a valid category. */
  category: string | null;
  /** null means all statuses. */
  status: CardStatus | null;
  hidden: HiddenFilter;
};

export const DEFAULT_LIBRARY_FILTER: LibraryFilter = {
  search: "",
  deckId: null,
  category: null,
  status: null,
  hidden: "all",
};

/**
 * Fast mode keeps only the search term: every other filter is ignored so a
 * lookup always covers all decks, categories, statuses and hidden cards.
 */
export function withFastMode(
  filter: LibraryFilter,
  fastMode: boolean,
): LibraryFilter {
  if (!fastMode) {
    return filter;
  }

  return { ...DEFAULT_LIBRARY_FILTER, search: filter.search };
}

export function normalizeLibraryFilter(
  input: Partial<LibraryFilter>,
): LibraryFilter {
  const status =
    typeof input.status === "string" &&
    (CARD_STATUSES as readonly string[]).includes(input.status)
      ? (input.status as CardStatus)
      : null;

  const hidden =
    input.hidden === "visible" || input.hidden === "hidden"
      ? input.hidden
      : "all";

  return {
    search: typeof input.search === "string" ? input.search.trim() : "",
    deckId: typeof input.deckId === "string" ? input.deckId : null,
    category: typeof input.category === "string" ? input.category : null,
    status,
    hidden,
  };
}

export function matchesLibraryFilter(
  card: LibraryCard,
  filter: LibraryFilter,
): boolean {
  if (filter.deckId !== null && card.deckId !== filter.deckId) {
    return false;
  }

  if (filter.category !== null && card.category !== filter.category) {
    return false;
  }

  if (filter.status !== null && card.status !== filter.status) {
    return false;
  }

  if (filter.hidden === "visible" && card.hidden) {
    return false;
  }

  if (filter.hidden === "hidden" && !card.hidden) {
    return false;
  }

  const query = normalizeText(filter.search);
  if (query === "") {
    return true;
  }

  const haystack = normalizeText(
    [card.termEng, card.termEsp, card.category, card.description].join(" "),
  );

  return haystack.includes(query);
}

/** Filters and sorts cards alphabetically by term. */
export function filterCards(
  cards: readonly LibraryCard[],
  filter: LibraryFilter,
): LibraryCard[] {
  return cards
    .filter((card) => matchesLibraryFilter(card, filter))
    .sort(
      (a, b) =>
        a.termEng.localeCompare(b.termEng, "es") ||
        a.termEsp.localeCompare(b.termEsp, "es"),
    );
}
