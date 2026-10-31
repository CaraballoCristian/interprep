import { buildDeck } from "@lib/study/deck";
import { applyResultToCard } from "@lib/study/history";
import {
  createReviewRound,
  createRound,
  currentCardId,
  isRoundComplete,
  recordRoundResult,
  removeCurrentFromRound,
  summarizeRound,
  type RoundState,
} from "@lib/study/round";
import type {
  SessionUndo,
  StudyAction,
  StudySession,
  StudyView,
} from "@lib/study/session";
import type { StudyCard, StudyConfig } from "@lib/study/types";
import { normalizeConfig } from "@lib/templates/validation";
import {
  createUndoEntry,
  isUndoAvailable,
  UNDO_WINDOW_MS,
} from "@lib/study/undo";
import { CARD_STATUSES } from "@lib/types";
import {
  getStudyCard,
  listStudyCards,
  restoreCardFields,
  updateCardHidden,
  updateCardResult,
  updateCardStatus,
} from "@/db/repositories/cards";
import {
  loadStudySession,
  saveStudySession,
} from "@/db/repositories/session";
import { getTemplateById } from "@/db/repositories/templates";
import type { Template } from "@/db/schema";
import { getSettings } from "@/db/bootstrap";

export type StudyErrorCode =
  | "no_current_card"
  | "not_flipped"
  | "undo_unavailable"
  | "no_failed_cards";

export class StudyError extends Error {
  readonly code: StudyErrorCode;

  constructor(code: StudyErrorCode) {
    super(code);
    this.name = "StudyError";
    this.code = code;
  }
}

const DEFAULT_CONFIG: StudyConfig = {
  sideA: ["termEng"],
  sideB: ["termEsp", "description"],
  categories: null,
  statuses: [...CARD_STATUSES],
};

function cloneRound(round: RoundState): RoundState {
  return {
    order: [...round.order],
    index: round.index,
    results: { ...round.results },
    seen: [...round.seen],
    failed: [...round.failed],
  };
}

function configFromTemplate(template: Template | null): {
  config: StudyConfig;
  templateId: string | null;
} {
  if (!template) {
    return { config: DEFAULT_CONFIG, templateId: null };
  }

  return {
    config: normalizeConfig({
      sideA: template.sideA,
      sideB: template.sideB,
      categories: template.categories,
      statuses: template.statuses,
    }),
    templateId: template.id,
  };
}

/**
 * Drops cards that no longer exist and cards that left the deck (status or
 * hidden changed outside the study screen) from the remaining order. Seen
 * cards keep their place so the progress counters stay exact.
 */
function repairRound(
  round: RoundState,
  cards: readonly StudyCard[],
  config: StudyConfig,
): RoundState {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const deckIds = new Set(buildDeck(cards, config).map((card) => card.id));

  let index = round.index;
  const order: string[] = [];

  round.order.forEach((id, position) => {
    if (!cardsById.has(id)) {
      if (position < index) {
        index -= 1;
      }
      return;
    }

    if (position >= index && !deckIds.has(id)) {
      return;
    }

    order.push(id);
  });

  return { ...round, order, index };
}

function repairSession(session: StudySession): StudySession {
  const cards = listStudyCards();
  const deck = buildDeck(cards, session.config);
  const round = repairRound(session.round, cards, session.config);

  // A session saved while the deck was empty can pick up newly imported cards.
  if (round.order.length === 0 && round.seen.length === 0 && deck.length > 0) {
    return {
      ...session,
      round: createRound(deck),
      flipped: false,
      undo: null,
    };
  }

  const roundChanged =
    round.order.length !== session.round.order.length ||
    round.index !== session.round.index;

  return roundChanged ? { ...session, round } : session;
}

/** Loads the persisted session, creating or repairing it when needed. */
function ensureSession(): StudySession {
  const existing = loadStudySession();
  if (existing) {
    const repaired = repairSession(existing);
    if (repaired !== existing) {
      saveStudySession(repaired);
    }
    return repaired;
  }

  const settings = getSettings();
  const template = settings.lastTemplateId
    ? getTemplateById(settings.lastTemplateId)
    : null;
  const { config, templateId } = configFromTemplate(template);
  const cards = listStudyCards();
  const now = new Date().toISOString();

  const session: StudySession = {
    version: 1,
    config,
    templateId,
    round: createRound(buildDeck(cards, config)),
    flipped: false,
    undo: null,
    createdAt: now,
    updatedAt: now,
  };

  saveStudySession(session);
  return session;
}

function persist(session: StudySession): void {
  saveStudySession({ ...session, updatedAt: new Date().toISOString() });
}

function buildView(session: StudySession, now: number): StudyView {
  const cards = listStudyCards();
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const currentId = currentCardId(session.round);
  const card = currentId ? (cardsById.get(currentId) ?? null) : null;

  const deck = buildDeck(cards, session.config);
  const complete = isRoundComplete(session.round);
  const metrics = summarizeRound(session.round);
  const summary =
    complete && session.round.seen.length > 0 ? metrics : null;

  const undoAvailable = isUndoAvailable(session.undo?.entry ?? null, now);

  return {
    config: session.config,
    templateId: session.templateId,
    flipped: session.flipped,
    card,
    progress: {
      index: session.round.index,
      total: session.round.order.length,
      seen: session.round.seen.length,
    },
    metrics,
    summary,
    failedIds: session.round.failed,
    undoAvailable,
    undoExpiresAt:
      undoAvailable && session.undo
        ? session.undo.entry.at + UNDO_WINDOW_MS
        : null,
    emptyDeck: summary === null && deck.length === 0,
  };
}

function currentCardOrThrow(session: StudySession): StudyCard {
  const id = currentCardId(session.round);
  const card = id ? getStudyCard(id) : null;
  if (!card) {
    throw new StudyError("no_current_card");
  }
  return card;
}

function snapshotUndo(
  kind: "result" | "status" | "hide",
  session: StudySession,
  card: StudyCard,
  now: number,
): SessionUndo {
  return {
    entry: createUndoEntry(kind, card, now),
    round: cloneRound(session.round),
    flipped: session.flipped,
  };
}

/** Returns the current view of the study session. */
export function getStudyView(now = Date.now()): StudyView {
  const session = ensureSession();
  return buildView(session, now);
}

/** Applies a study action, persists the session and returns the new view. */
export function applyStudyAction(
  action: StudyAction,
  now = Date.now(),
): StudyView {
  const session = ensureSession();

  switch (action.type) {
    case "flip": {
      session.flipped = action.flipped;
      persist(session);
      return buildView(session, now);
    }

    case "result": {
      if (!session.flipped) {
        throw new StudyError("not_flipped");
      }

      const card = currentCardOrThrow(session);
      session.undo = snapshotUndo("result", session, card, now);

      const updated = applyResultToCard(card, action.result);
      updateCardResult(card.id, {
        history: updated.history,
        totalSuccess: updated.totalSuccess,
        totalFail: updated.totalFail,
      });

      session.round = recordRoundResult(
        session.round,
        card.id,
        action.result,
      );
      session.flipped = false;
      persist(session);
      return buildView(session, now);
    }

    case "status": {
      const card = currentCardOrThrow(session);
      if (card.status === action.status) {
        return buildView(session, now);
      }

      session.undo = snapshotUndo("status", session, card, now);
      updateCardStatus(card.id, action.status);

      if (!session.config.statuses.includes(action.status)) {
        session.round = removeCurrentFromRound(session.round);
        session.flipped = false;
      }

      persist(session);
      return buildView(session, now);
    }

    case "hide": {
      const card = currentCardOrThrow(session);
      session.undo = snapshotUndo("hide", session, card, now);
      updateCardHidden(card.id, true);
      session.round = removeCurrentFromRound(session.round);
      session.flipped = false;
      persist(session);
      return buildView(session, now);
    }

    case "undo": {
      const undo = session.undo;
      if (!undo || !isUndoAvailable(undo.entry, now)) {
        throw new StudyError("undo_unavailable");
      }

      restoreCardFields(undo.entry.cardId, undo.entry.snapshot);
      session.round = cloneRound(undo.round);
      session.flipped = undo.flipped;
      session.undo = null;
      persist(session);
      return buildView(session, now);
    }

    case "new-round": {
      const cards = listStudyCards();
      session.round = createRound(buildDeck(cards, session.config));
      session.flipped = false;
      session.undo = null;
      persist(session);
      return buildView(session, now);
    }

    case "review-failed": {
      const cards = listStudyCards();
      const deck = buildDeck(cards, session.config);
      const round = createReviewRound(deck, session.round.failed);
      if (round.order.length === 0) {
        throw new StudyError("no_failed_cards");
      }

      session.round = round;
      session.flipped = false;
      session.undo = null;
      persist(session);
      return buildView(session, now);
    }
  }
}

/**
 * Replaces the active config and starts a new round with the recomputed deck.
 * `templateId` is set when the config comes from a template and null when it
 * comes from manual filters.
 */
export function applyStudyConfig(
  config: StudyConfig,
  templateId: string | null = null,
  now = Date.now(),
): StudyView {
  const session = ensureSession();
  const cards = listStudyCards();

  session.config = config;
  session.templateId = templateId;
  session.round = createRound(buildDeck(cards, config));
  session.flipped = false;
  session.undo = null;
  persist(session);

  return buildView(session, now);
}

/**
 * Detaches a deleted template from the saved session without creating one or
 * touching the current round.
 */
export function detachSessionTemplate(templateId: string): void {
  const session = loadStudySession();
  if (!session || session.templateId !== templateId) {
    return;
  }

  saveStudySession({
    ...session,
    templateId: null,
    updatedAt: new Date().toISOString(),
  });
}
