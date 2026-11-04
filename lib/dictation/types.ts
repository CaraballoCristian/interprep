import type { CardStatus } from "../types";

export const DICTATION_DIRECTIONS = ["en-es", "es-en"] as const;
export type DictationDirection = (typeof DICTATION_DIRECTIONS)[number];

export const DICTATION_LENGTHS = ["short", "medium", "long"] as const;
export type DictationLength = (typeof DICTATION_LENGTHS)[number];

export const DICTATION_SPEEDS = ["slow", "normal", "fast"] as const;
export type DictationSpeed = (typeof DICTATION_SPEEDS)[number];

/** Number of glossary terms forced into each phrase. */
export const DICTATION_TERMS_BY_LENGTH: Record<DictationLength, number> = {
  short: 3,
  medium: 4,
  long: 5,
};

/**
 * The category whose terms supplement every scenario. It is intentionally
 * excluded from the scenario pool: it adds vocabulary, it is not a situation.
 */
export const GENERAL_CATEGORY = "General";

/** Direction actually used for a generated phrase. */
export type ResolvedDirection = DictationDirection;

export type DictationConfig = {
  /** null means "every scenario category". General is always separate. */
  categories: string[] | null;
  includeGeneral: boolean;
  statuses: CardStatus[];
  direction: DictationDirection;
  length: DictationLength;
  autoplay: boolean;
  listenMode: boolean;
  speed: DictationSpeed;
  /** Silence limit in seconds, only used in listen mode. */
  silenceSeconds: number;
};

/** Minimal card projection needed to build a phrase. */
export type DictationCard = {
  id: string;
  category: string;
  termEng: string;
  termEsp: string;
  status: CardStatus;
  hidden: boolean;
};

export type DictationTerm = {
  cardId: string;
  category: string;
  termEng: string;
  termEsp: string;
};

export type DictationWarning =
  | { code: "category_empty"; category: string }
  | { code: "general_empty" };

export type DictationPhrase = {
  id: string;
  sideA: string;
  sideB: string;
  direction: ResolvedDirection;
  scenarioCategory: string;
  terms: DictationTerm[];
  createdAt: string;
};

export type DictationEntry = {
  phrase: DictationPhrase;
  warnings: DictationWarning[];
};

export type DictationCategoryInfo = {
  name: string;
  /** Visible cards in this category. */
  total: number;
  byStatus: Record<CardStatus, number>;
};

export type DictationMeta = {
  config: DictationConfig;
  categories: DictationCategoryInfo[];
  hasApiKey: boolean;
  keyHint: string | null;
  model: string;
};

export type DictationGenerateResponse = {
  phrase: DictationPhrase;
  warnings: DictationWarning[];
};
