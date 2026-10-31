import type { CardResult, CardStatus, SideField } from "../types";

export type StudyCard = {
  id: string;
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
  statuses: CardStatus[];
};
