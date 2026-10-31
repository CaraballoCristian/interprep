import type { CardResult, CardStatus } from "../types";
import type { RoundState, RoundSummary } from "./round";
import type { StudyCard, StudyConfig } from "./types";
import type { UndoEntry } from "./undo";

/** Serializable session persisted in `session_state`. */
export type StudySession = {
  version: 1;
  config: StudyConfig;
  templateId: string | null;
  round: RoundState;
  flipped: boolean;
  undo: SessionUndo | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionUndo = {
  entry: UndoEntry;
  /** Round state before the undoable action. */
  round: RoundState;
  flipped: boolean;
};

/** Payload consumed by the study screen. */
export type StudyView = {
  config: StudyConfig;
  templateId: string | null;
  flipped: boolean;
  card: StudyCard | null;
  progress: { index: number; total: number; seen: number };
  metrics: RoundSummary;
  summary: RoundSummary | null;
  failedIds: string[];
  undoAvailable: boolean;
  undoExpiresAt: number | null;
  emptyDeck: boolean;
};

export type StudyAction =
  | { type: "flip"; flipped: boolean }
  | { type: "result"; result: CardResult }
  | { type: "status"; status: CardStatus }
  | { type: "hide" }
  | { type: "undo" }
  | { type: "new-round" }
  | { type: "review-failed" };
