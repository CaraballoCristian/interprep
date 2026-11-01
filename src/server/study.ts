import { buildDeck } from "@lib/study/deck";
import { applyResultToCard } from "@lib/study/history";
import {
  cloneRound,
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
  ReviewOption,
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
import { DEFAULT_CARD_STATUSES, type CardStatus } from "@lib/types";
import {
  getStudyCard,
  listStudyCards,
  restoreCardFields,
  updateCardHidden,
  updateCardStudyFields,
} from "@/db/repositories/cards";
import {
  clearStudySession,
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
  statuses: [...DEFAULT_CARD_STATUSES],
  continuous: false,
};

const REVIEW_STATUSES: readonly CardStatus[] = ["new", "easy", "hard"];

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
    undoStack: [],
    resumePending: false,
    createdAt: now,
    updatedAt: now,
  };
}

function repairSession(session: StudySession): StudySession {
  const cards = listStudyCards();
  const deck = buildDeck(cards, session.config);
  const round = repairRound(session.round, cards, session.config);
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  // A session saved while the deck was empty can pick up newly imported cards.
  if (round.deck.length === 0 && round.answered === 0 && deck.length > 0) {
    return {
      ...freshSession(session.config, session.templateId, cards),
      createdAt: session.createdAt,
    };
  }

  // Undo entries whose card was deleted can no longer restore the card.
  const undoStack = session.undoStack.filter((item) =>
    cardsById.has(item.entry.cardId),
  );

  const roundChanged = round !== session.round;
  const undoChanged = undoStack.length !== session.undoStack.length;

  return roundChanged || undoChanged
    ? { ...session, round, undoStack }
    : session;
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
  const session = freshSession(config, templateId, listStudyCards());

  saveStudySession(session);
  return session;
}

function persist(session: StudySession): void {
  saveStudySession({ ...session, updatedAt: new Date().toISOString() });
}

/** The next visit should ask whether to resume once the round has answers. */
function markResumePending(session: StudySession): void {
  session.resumePending = session.round.answered > 0;
}

function reviewOptions(round: RoundState): ReviewOption[] {
  return REVIEW_STATUSES.map((status) => ({
    status,
    count: round.deck.filter((id) => round.resolved[id] === status).length,
  }));
}

type BuildViewOptions = {
  suppressResumePrompt?: boolean;
};

function buildView(
  session: StudySession,
  now: number,
  options: BuildViewOptions = {},
): StudyView {
  const cards = listStudyCards();
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
    card,
    progress: {
      seen: metrics.seen,
      total: metrics.total,
      answered: round.answered,
    },
    metrics,
    summary,
    reviewOptions: reviewOptions(round),
    undoAvailable: undoAvailable(session.undoStack),
    undoCount: session.undoStack.length,
    resumePending:
      options.suppressResumePrompt === true ? false : session.resumePending,
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

/** Returns the current view of the study session. */
export function getStudyView(now = Date.now()): StudyView {
  const session = ensureSession();
  return buildView(session, now);
}

/** Applies a study action, persists the session and returns the new view. */
export function applyStudyAction(
  action: StudyAction,
  now = Date.now(),
  random: () => number = Math.random,
): StudyView {
  const session = ensureSession();

  switch (action.type) {
    case "flip": {
      session.flipped = action.flipped;
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "status": {
      if (!session.flipped) {
        throw new StudyError("not_flipped");
      }

      const card = currentCardOrThrow(session);
      session.undoStack = pushUndo(
        session.undoStack,
        createSessionUndo(
          "status",
          card,
          cloneRound(session.round),
          session.flipped,
          now,
        ),
      );

      const withResult =
        action.status === "easy"
          ? applyResultToCard(card, "s")
          : action.status === "hard"
            ? applyResultToCard(card, "f")
            : card;

      updateCardStudyFields(card.id, {
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
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "hide": {
      const card = currentCardOrThrow(session);
      session.undoStack = pushUndo(
        session.undoStack,
        createSessionUndo(
          "hide",
          card,
          cloneRound(session.round),
          session.flipped,
          now,
        ),
      );

      updateCardHidden(card.id, true);
      session.round = removeCurrentFromRound(session.round);
      session.flipped = false;
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "undo": {
      const undo = session.undoStack[session.undoStack.length - 1];
      if (!undo) {
        throw new StudyError("undo_unavailable");
      }

      restoreCardFields(undo.entry.cardId, undo.entry.snapshot);
      session.round = repairRound(
        cloneRound(undo.round),
        listStudyCards(),
        session.config,
      );
      session.flipped = undo.flipped;
      session.undoStack = session.undoStack.slice(0, -1);
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "new-round": {
      const cards = listStudyCards();
      session.round = createRound(
        buildDeck(cards, session.config),
        modeFor(session.config),
        random,
      );
      session.flipped = false;
      session.undoStack = [];
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "review": {
      const cards = listStudyCards();
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
      session.undoStack = [];
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
    }

    case "resume": {
      session.resumePending = false;
      persist(session);
      return buildView(session, now);
    }

    case "reset": {
      const fresh = freshSession(
        session.config,
        session.templateId,
        listStudyCards(),
        random,
      );
      fresh.createdAt = session.createdAt;
      persist(fresh);
      return buildView(fresh, now);
    }

    case "finish": {
      clearStudySession();
      const fresh = freshSession(
        session.config,
        session.templateId,
        listStudyCards(),
        random,
      );
      persist(fresh);
      return buildView(fresh, now, { suppressResumePrompt: true });
    }

    case "leave": {
      markResumePending(session);
      persist(session);
      return buildView(session, now, { suppressResumePrompt: true });
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
  const fresh = freshSession(config, templateId, cards);
  fresh.createdAt = session.createdAt;

  persist(fresh);
  return buildView(fresh, now, { suppressResumePrompt: true });
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
