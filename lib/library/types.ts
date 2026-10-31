import type { CardResult, CardStatus } from "../types";

/** Card shape used by the library and by the export helpers. */
export type LibraryCard = {
  id: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
  hidden: boolean;
  history: CardResult[];
  totalSuccess: number;
  totalFail: number;
  createdAt: string;
  updatedAt: string;
};
