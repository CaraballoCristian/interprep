import type { CardStatus } from "../types";
import { normalizeConfig } from "../templates/validation";
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
  /**
   * True once the current card has been shown on side B at least once.
   * Status actions are gated on this flag, not on `flipped`, so going back to
   * side A does not lock them again.
   */
  revealed: boolean;
  undoStack: SessionUndo[];
  /** True when the next visit should ask whether to resume. */
  resumePending: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Payload consumed by the study screen. */
export type StudyView = {
  config: StudyConfig;
  templateId: string | null;
  mode: RoundMode;
  flipped: boolean;
  revealed: boolean;
  card: StudyCard | null;
  progress: { seen: number; total: number; answered: number };
  metrics: RoundSummary;
  summary: RoundSummary | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUndo(value: unknown): SessionUndo | null {
  if (
    !isRecord(value) ||
    !isRecord(value.entry) ||
    !isRecord(value.round) ||
    !Array.isArray(value.round.deck) ||
    !Array.isArray(value.round.queue)
  ) {
    return null;
  }

  const flipped = value.flipped === true;

  return {
    entry: value.entry as unknown as SessionUndo["entry"],
    round: value.round as unknown as RoundState,
    flipped,
    revealed:
      typeof value.revealed === "boolean" ? value.revealed : flipped,
  };
}

/**
 * Validates a stored session and fills values added after version 2 was
 * introduced. Missing `revealed` falls back to `flipped` so sessions saved
 * before the flag existed keep working.
 */
export function normalizeStudySession(value: unknown): StudySession | null {
  if (!isRecord(value) || value.version !== 2) {
    return null;
  }

  const round = value.round;
  if (
    !isRecord(round) ||
    !Array.isArray(round.deck) ||
    !Array.isArray(round.queue) ||
    !Array.isArray(value.undoStack)
  ) {
    return null;
  }

  const flipped = value.flipped === true;
  const undoStack = value.undoStack
    .map(normalizeUndo)
    .filter((entry): entry is SessionUndo => entry !== null);

  return {
    version: 2,
    config: normalizeConfig(value.config),
    templateId: typeof value.templateId === "string" ? value.templateId : null,
    round: round as unknown as RoundState,
    flipped,
    revealed:
      typeof value.revealed === "boolean" ? value.revealed : flipped,
    undoStack,
    resumePending: value.resumePending === true,
    createdAt:
      typeof value.createdAt === "string"
        ? value.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : new Date().toISOString(),
  };
}
