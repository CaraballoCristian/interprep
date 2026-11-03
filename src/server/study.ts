import { buildDeck } from "@lib/study/deck";
import { applyResultToCard } from "@lib/study/history";
import {
  createReviewRound,
  createRound,
  currentCardId,
  isRoundComplete,
  recordStatus,
  refillRound,
  removeCurrentFromRound,
  summarizeRound,
  type RoundMode,
  type RoundState,
} from "@lib/study/round";
import type {
  StudyAction,
  StudySession,
  StudyView,
} from "@lib/study/session";
import type { StudyCard, StudyConfig } from "@lib/study/types";
import {
  createSessionUndo,
  pushUndo,
  undoAvailable,
} from "@lib/study/undo";
import { normalizeConfig } from "@lib/templates/validation";
import { DEFAULT_CARD_STATUSES } from "@lib/types";
import {
  getStudyCard,
  listStudyCards,
  restoreCardFields,
  updateCardHidden,
  updateCardStudyFields,
} from "@/db/repositories/cards";
import { listDecks } from "@/db/repositories/decks";
import {
  loadStudySession,
  saveStudySession,
} from "@/db/repositories/session";
import { getTemplateById } from "@/db/repositories/templates";
import type { Template } from "@/db/schema";
import { getSettings } from "@/db/workspace";
import { pruneConfigDecks } from "./decks";

export type StudyErrorCode =
  | "no_current_card"
  | "not_revealed"
  | "undo_unavailable"
  | "no_review_cards";

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
  deckIds: null,
  statuses: [...DEFAULT_CARD_STATUSES],
  continuous: false,
};

function modeFor(config: StudyConfig): RoundMode {
  return config.continuous ? "continuous" : "standard";
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
      deckIds: template.deckIds,
      statuses: template.statuses,
      continuous: template.continuous,
    }),
    templateId: template.id,
  };
}

/**
 * Drops cards that no longer exist and cards that left the deck (status or
 * hidden changed outside the study screen) from the upcoming queue. Already
 * answered cards keep their place so the stats stay meaningful.
 */
function repairRound(
  round: RoundState,
  cards: readonly StudyCard[],
  config: StudyConfig,
): RoundState {
  const existingIds = new Set(cards.map((card) => card.id));
  const deckIds = new Set(buildDeck(cards, config).map((card) => card.id));
  const deck = round.deck.filter(
    (id) => existingIds.has(id) && deckIds.has(id),
  );
  const deckSet = new Set(deck);

  return refillRound({
    ...round,
    deck,
    queue: round.queue.filter((id) => deckSet.has(id)),
    pending: round.pending.filter((item) => deckSet.has(item.cardId)),
    seen: round.seen.filter((id) => existingIds.has(id)),
    resolved: Object.fromEntries(
      Object.entries(round.resolved).filter(([id]) => existingIds.has(id)),
    ),
    learned: round.learned.filter((id) => existingIds.has(id)),
  });
}

function freshSession(
  config: StudyConfig,
  templateId: string | null,
  cards: readonly StudyCard[],
  random: () => number = Math.random,
): StudySession {
  const now = new Date().toISOString();

  return {
    version: 2,
    config,
    templateId,
    round: createRound(buildDeck(cards, config), modeFor(config), random),
    flipped: false,
    revealed: false,
    undoStack: [],
    resumePending: false,
    createdAt: now,
    updatedAt: now,
  };
}

function repairSession(
  userId: string,
  session: StudySession,
): StudySession {
  const cards = listStudyCards(userId);
  const existingDeckIds = new Set(
    listDecks(userId).map((deck) => deck.id),
  );
  const config = pruneConfigDecks(userId, session.config, existingDeckIds);
  const deck = buildDeck(cards, config);
  const round = repairRound(session.round, cards, config);
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  // A session saved while the deck was empty can pick up newly imported cards.
  if (round.deck.length === 0 && round.answered === 0 && deck.length > 0) {
    return {
      ...freshSession(config, session.templateId, cards),
      createdAt: session.createdAt,
    };
  }

  // Undo entries whose card was deleted can no longer restore the card.
  const undoStack = session.undoStack.filter((item) =>
    cardsById.has(item.entry.cardId),
  );

  const configChanged = config !== session.config;
  const roundChanged = round !== session.round;
  const undoChanged = undoStack.length !== session.undoStack.length;

  return configChanged || roundChanged || undoChanged
    ? { ...session, config, round, undoStack }
    : session;
}

/** Loads the persisted session, creating or repairing it when needed. */
function ensureSession(userId: string): StudySession {
  const existing = loadStudySession(userId);
  if (existing) {
    const repaired = repairSession(userId, existing);
    if (repaired !== existing) {
      saveStudySession(userId, repaired);
    }
    return repaired;
  }

  const settings = getSettings(userId);
  const template = settings.lastTemplateId
    ? getTemplateById(userId, settings.lastTemplateId)
    : null;
  const { config, templateId } = configFromTemplate(template);
  const session = freshSession(config, templateId, listStudyCards(userId));

  saveStudySession(userId, session);
  return session;
}

function persist(userId: string, session: StudySession): void {
  saveStudySession(userId, {
    ...session,
    updatedAt: new Date().toISOString(),
  });
}

/** The next visit should ask whether to resume once the round has answers. */
function markResumePending(session: StudySession): void {
  session.resumePending = session.round.answered > 0;
}

type BuildViewOptions = {
  suppressResumePrompt?: boolean;
};

function buildView(
  userId: string,
  session: StudySession,
  options: BuildViewOptions = {},
): StudyView {
  const cards = listStudyCards(userId);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const round = refillRound(session.round);
  const currentId = currentCardId(round);
  const card = currentId ? (cardsById.get(currentId) ?? null) : null;

  const deck = buildDeck(cards, session.config);
  const complete = isRoundComplete(round);
  const metrics = summarizeRound(round);
  const summary = complete && round.answered > 0 ? metrics : null;

  return {
    config: session.config,
    templateId: session.templateId,
    mode: round.mode,
    flipped: session.flipped,
    revealed: session.revealed,
    card,
    progress: {
      seen: metrics.seen,
      total: metrics.total,
      answered: round.answered,
    },
    metrics,
    summary,
    undoAvailable: undoAvailable(session.undoStack),
    undoCount: session.undoStack.length,
    resumePending:
      options.suppressResumePrompt === true ? false : session.resumePending,
    emptyDeck: summary === null && deck.length === 0,
  };
}

function currentCardOrThrow(
  userId: string,
  session: StudySession,
): StudyCard {
  const id = currentCardId(session.round);
  const card = id ? getStudyCard(userId, id) : null;
  if (!card) {
    throw new StudyError("no_current_card");
  }
  return card;
}

/** Returns the current view of the study session. */
export function getStudyView(userId: string): StudyView {
  const session = ensureSession(userId);
  return buildView(userId, session);
}

/** Applies a study action, persists the session and returns the new view. */
export function applyStudyAction(
  userId: string,
  action: StudyAction,
  now = Date.now(),
  random: () => number = Math.random,
): StudyView {
  const session = ensureSession(userId);

  switch (action.type) {
    case "flip": {
      session.flipped = action.flipped;
      if (action.flipped) {
        session.revealed = true;
      }
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "status": {
      if (!session.revealed) {
        throw new StudyError("not_revealed");
      }

      const card = currentCardOrThrow(userId, session);
      session.undoStack = pushUndo(
        session.undoStack,
        createSessionUndo(
          "status",
          card,
          session.round,
          session.flipped,
          session.revealed,
          now,
        ),
      );

      const withResult =
        action.status === "easy"
          ? applyResultToCard(card, "s")
          : action.status === "hard"
            ? applyResultToCard(card, "f")
            : card;

      updateCardStudyFields(userId, card.id, {
        status: action.status,
        history: withResult.history,
        totalSuccess: withResult.totalSuccess,
        totalFail: withResult.totalFail,
      });

      session.round = recordStatus(session.round, card.id, action.status, {
        selectedStatuses: session.config.statuses,
        random,
      });
      session.flipped = false;
      session.revealed = false;
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "hide": {
      const card = currentCardOrThrow(userId, session);
      session.undoStack = pushUndo(
        session.undoStack,
        createSessionUndo(
          "hide",
          card,
          session.round,
          session.flipped,
          session.revealed,
          now,
        ),
      );

      updateCardHidden(userId, card.id, true);
      session.round = removeCurrentFromRound(session.round);
      session.flipped = false;
      session.revealed = false;
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "undo": {
      const undo = session.undoStack[session.undoStack.length - 1];
      if (!undo) {
        throw new StudyError("undo_unavailable");
      }

      restoreCardFields(userId, undo.entry.cardId, undo.entry.snapshot);
      session.round = repairRound(
        undo.round,
        listStudyCards(userId),
        session.config,
      );
      session.flipped = undo.flipped;
      session.revealed = undo.revealed;
      session.undoStack = session.undoStack.slice(0, -1);
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "new-round": {
      const cards = listStudyCards(userId);
      session.round = createRound(
        buildDeck(cards, session.config),
        modeFor(session.config),
        random,
      );
      session.flipped = false;
      session.revealed = false;
      session.undoStack = [];
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "review": {
      const cards = listStudyCards(userId);
      const round = createReviewRound(
        cards,
        session.round,
        action.statuses,
        random,
      );

      if (round.deck.length === 0) {
        throw new StudyError("no_review_cards");
      }

      session.round = round;
      session.flipped = false;
      session.revealed = false;
      session.undoStack = [];
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }

    case "resume": {
      session.resumePending = false;
      persist(userId, session);
      return buildView(userId, session);
    }

    case "reset": {
      const fresh = freshSession(
        session.config,
        session.templateId,
        listStudyCards(userId),
        random,
      );
      fresh.createdAt = session.createdAt;
      persist(userId, fresh);
      return buildView(userId, fresh);
    }

    case "finish": {
      const fresh = freshSession(
        session.config,
        session.templateId,
        listStudyCards(userId),
        random,
      );
      persist(userId, fresh);
      return buildView(userId, fresh, { suppressResumePrompt: true });
    }

    case "leave": {
      markResumePending(session);
      persist(userId, session);
      return buildView(userId, session, { suppressResumePrompt: true });
    }
  }
}

/**
 * Replaces the active config and starts a new round with the recomputed deck.
 * `templateId` is set when the config comes from a template and null when it
 * comes from manual filters.
 */
export function applyStudyConfig(
  userId: string,
  inputConfig: StudyConfig,
  templateId: string | null = null,
): StudyView {
  const session = ensureSession(userId);
  const cards = listStudyCards(userId);
  const config = pruneConfigDecks(userId, inputConfig);
  const fresh = freshSession(config, templateId, cards);
  fresh.createdAt = session.createdAt;

  persist(userId, fresh);
  return buildView(userId, fresh, { suppressResumePrompt: true });
}

/**
 * Detaches a deleted template from the saved session without creating one or
 * touching the current round.
 */
export function detachSessionTemplate(
  userId: string,
  templateId: string,
): void {
  const session = loadStudySession(userId);
  if (!session || session.templateId !== templateId) {
    return;
  }

  saveStudySession(userId, {
    ...session,
    templateId: null,
    updatedAt: new Date().toISOString(),
  });
}
