/** Deck shape used by the API and the UI. */
export type Deck = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** Deck plus the number of cards it contains. */
export type DeckSummary = Deck & {
  cardCount: number;
};

/** Name used when the database has no decks yet. */
export const DEFAULT_DECK_NAME = "General";

/** Maximum length of a deck name, after trimming. */
export const DECK_NAME_MAX_LENGTH = 80;
