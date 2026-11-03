import type { CardResult, CardStatus, SideField } from "../types";

export type StudyCard = {
  id: string;
  deckId: string;
  category: string;
  termEng: string;
  termEsp: string;
  description: string;
  status: CardStatus;
  hidden: boolean;
  history: CardResult[];
  totalSuccess: number;
  totalFail: number;
};

export type StudyConfig = {
  sideA: SideField[];
  sideB: SideField[];
  /** null means "all categories". */
  categories: string[] | null;
  /** null means "all decks", including decks created later. */
  deckIds: string[] | null;
  statuses: CardStatus[];
  /**
   * Continuous rounds keep repeating HARD/NEW cards until every card is
   * EASY or LEARNED. Standard rounds are a single pass (NEW still repeats).
   */
  continuous: boolean;
};
