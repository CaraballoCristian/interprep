export const CARD_STATUSES = ["new", "easy", "hard", "learned"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

/**
 * Statuses included by default in a new round/template. `learned` is the
 * archive state and only enters a round when it is explicitly selected.
 */
export const DEFAULT_CARD_STATUSES = ["new", "easy", "hard"] as const;

export const CARD_RESULTS = ["s", "f"] as const;
export type CardResult = (typeof CARD_RESULTS)[number];

export const SIDE_FIELDS = ["termEng", "termEsp", "description"] as const;
export type SideField = (typeof SIDE_FIELDS)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
