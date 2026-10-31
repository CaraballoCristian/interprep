export const CARD_STATUSES = ["new", "learning", "learned"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_RESULTS = ["s", "f"] as const;
export type CardResult = (typeof CARD_RESULTS)[number];

export const SIDE_FIELDS = ["termEng", "termEsp", "description"] as const;
export type SideField = (typeof SIDE_FIELDS)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
