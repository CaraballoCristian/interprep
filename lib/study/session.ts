import type { CardStatus } from "../types";
import type { RoundMode, RoundState, RoundSummary } from "./round";
import type { StudyCard, StudyConfig } from "./types";
import type { SessionUndo } from "./undo";

export type { SessionUndo } from "./undo";

/** Serializable session persisted in `session_state`. */
export type StudySession = {
  version: 2;
  config: StudyConfig;
  templateId: string | null;
  round: RoundState;
  flipped: boolean;
  undoStack: SessionUndo[];
  /** True when the next visit should ask whether to resume. */
  resumePending: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReviewOption = {
  status: CardStatus;
  count: number;
};

/** Payload consumed by the study screen. */
export type StudyView = {
  config: StudyConfig;
  templateId: string | null;
  mode: RoundMode;
  flipped: boolean;
  card: StudyCard | null;
  progress: { seen: number; total: number; answered: number };
  metrics: RoundSummary;
  summary: RoundSummary | null;
  reviewOptions: ReviewOption[];
  undoAvailable: boolean;
  undoCount: number;
  resumePending: boolean;
  emptyDeck: boolean;
};

export type StudyAction =
  | { type: "flip"; flipped: boolean }
  | { type: "status"; status: CardStatus }
  | { type: "hide" }
  | { type: "undo" }
  | { type: "new-round" }
  | { type: "review"; statuses: CardStatus[] }
  | { type: "resume" }
  | { type: "reset" }
  | { type: "finish" }
  | { type: "leave" };
