import type { CardStatus } from "../types";
import { weightedShuffle } from "./deck";
import type { StudyCard } from "./types";

/** A NEW card comes back after 5–10 answers. */
export const NEW_DELAY_MIN = 5;
export const NEW_DELAY_MAX = 10;

/** In continuous mode a HARD card comes back after 20–30 answers. */
export const HARD_DELAY_MIN = 20;
export const HARD_DELAY_MAX = 30;

export type RoundMode = "standard" | "continuous";

/** A card waiting to be shown again, measured in answers. */
export type PendingRepeat = {
  cardId: string;
  /** `answered` value at which the card becomes due. */
  dueAt: number;
};

export type RoundCounts = Record<CardStatus, number>;

/**
 * Serializable state of the round in progress.
 *
 * `queue` holds the upcoming cards (the current card is `queue[0]`). Cards can
 * appear more than once because NEW (and HARD in continuous mode) schedule a
 * repeat. `pending` stores those repeats until their delay elapses.
 */
export type RoundState = {
  mode: RoundMode;
  /** Distinct card ids that belong to this round. */
  deck: string[];
  /** Upcoming card ids, in order. */
  queue: string[];
  /** Repeats waiting for their delay. */
  pending: PendingRepeat[];
  /** Total number of status answers in this round (including repeats). */
  answered: number;
  /** Distinct cards answered at least once. */
  seen: string[];
  /** Last status chosen per card in this round. */
  resolved: Record<string, CardStatus>;
  /** Cards marked LEARNED in this round (for the header counter). */
  learned: string[];
  /** Number of times each status was chosen (for accuracy). */
  counts: RoundCounts;
};

export type RoundSummary = {
  seen: number;
  total: number;
  /** Total EASY answers, including repeats. */
  successes: number;
  /** Total HARD answers, including repeats. */
  failures: number;
  /** Cards currently marked LEARNED in this round. */
  learned: number;
  /** Final status of the cards in the round. */
  newCount: number;
  easyCount: number;
  hardCount: number;
  learnedCount: number;
  accuracy: number;
};

export function emptyCounts(): RoundCounts {
  return { new: 0, easy: 0, hard: 0, learned: 0 };
}

/** Inclusive random integer. `random` is injectable so tests are deterministic. */
export function randomInt(
  min: number,
  max: number,
  random: () => number = Math.random,
): number {
  const span = max - min + 1;
  const value = min + Math.floor(random() * span);
  return Math.min(max, Math.max(min, value));
}

export function cloneRound(round: RoundState): RoundState {
  return {
    mode: round.mode,
    deck: [...round.deck],
    queue: [...round.queue],
    pending: round.pending.map((item) => ({ ...item })),
    answered: round.answered,
    seen: [...round.seen],
    resolved: { ...round.resolved },
    learned: [...round.learned],
    counts: { ...round.counts },
  };
}

/**
 * Starts a round. Every deck card is included once in weighted random order;
 * repeats are added later when the player answers NEW/HARD.
 */
export function createRound(
  cards: readonly StudyCard[],
  mode: RoundMode = "standard",
  random: () => number = Math.random,
): RoundState {
  const deck = weightedShuffle(cards, random).map((card) => card.id);

  return {
    mode,
    deck,
    queue: [...deck],
    pending: [],
    answered: 0,
    seen: [],
    resolved: {},
    learned: [],
    counts: emptyCounts(),
  };
}

/**
 * Moves due repeats into the queue. When the queue runs out, every pending
 * card is shown immediately so a round can never end with repeats waiting.
 */
export function refillRound(round: RoundState): RoundState {
  if (round.queue.length > 0) {
    const due = round.pending.filter((item) => round.answered >= item.dueAt);
    if (due.length === 0) {
      return round;
    }

    const dueIds = due.map((item) => item.cardId);
    const inQueue = new Set(round.queue);
    const insert = dueIds.filter((id) => !inQueue.has(id));

    return {
      ...round,
      queue: [...insert, ...round.queue],
      pending: round.pending.filter((item) => round.answered < item.dueAt),
    };
  }

  if (round.pending.length === 0) {
    return round;
  }

  const ordered = [...round.pending].sort(
    (a, b) => a.dueAt - b.dueAt || a.cardId.localeCompare(b.cardId),
  );

  return {
    ...round,
    queue: ordered.map((item) => item.cardId),
    pending: [],
  };
}

export function currentCardId(round: RoundState): string | null {
  return round.queue[0] ?? null;
}

export function isRoundComplete(round: RoundState): boolean {
  const filled = refillRound(round);

  if (filled.queue.length > 0 || filled.pending.length > 0) {
    return false;
  }

  if (filled.mode === "continuous") {
    return filled.deck.every((id) => {
      const status = filled.resolved[id];
      return status === "easy" || status === "learned";
    });
  }

  return true;
}

export type RecordStatusOptions = {
  /** Statuses currently selected in the filters. */
  selectedStatuses: readonly CardStatus[];
  random?: () => number;
};

/**
 * Records the status of the current card and advances. Results for any other
 * card are ignored (only the card being shown can be answered).
 *
 * Repeats:
 * - NEW always comes back after 5–10 answers.
 * - HARD comes back after 20–30 answers in continuous mode.
 * - When the resulting status is not selected, the card leaves the round so a
 *   continuous round can finish.
 */
export function recordStatus(
  round: RoundState,
  cardId: string,
  status: CardStatus,
  options: RecordStatusOptions,
): RoundState {
  if (currentCardId(round) !== cardId) {
    return round;
  }

  const random = options.random ?? Math.random;
  const selected = options.selectedStatuses.includes(status);
  const answered = round.answered + 1;
  const queue = round.queue.slice(1);
  const seen = round.seen.includes(cardId)
    ? round.seen
    : [...round.seen, cardId];
  const resolved = { ...round.resolved, [cardId]: status };
  const counts = {
    ...round.counts,
    [status]: round.counts[status] + 1,
  };
  const learned =
    status === "learned"
      ? round.learned.includes(cardId)
        ? round.learned
        : [...round.learned, cardId]
      : round.learned.filter((id) => id !== cardId);

  let pending = round.pending.filter((item) => item.cardId !== cardId);
  let deck = round.deck;

  if (!selected && round.mode === "continuous") {
    // The new status is excluded by the filters: stop waiting for this card.
    deck = round.deck.filter((id) => id !== cardId);
  } else if (selected && status === "new") {
    const delay = randomInt(NEW_DELAY_MIN, NEW_DELAY_MAX, random);
    pending = [
      ...pending,
      { cardId, dueAt: answered + delay - 1 },
    ];
  } else if (
    selected &&
    status === "hard" &&
    round.mode === "continuous"
  ) {
    const delay = randomInt(HARD_DELAY_MIN, HARD_DELAY_MAX, random);
    pending = [
      ...pending,
      { cardId, dueAt: answered + delay - 1 },
    ];
  }

  return refillRound({
    ...round,
    deck,
    queue,
    pending,
    answered,
    seen,
    resolved,
    learned,
    counts,
  });
}

/**
 * Removes a card from the round entirely (e.g. it was hidden or deleted).
 * Used before the card was answered, so it is also removed from the stats.
 */
export function removeCardFromRound(
  round: RoundState,
  cardId: string,
): RoundState {
  return refillRound({
    ...round,
    deck: round.deck.filter((id) => id !== cardId),
    queue: round.queue.filter((id) => id !== cardId),
    pending: round.pending.filter((item) => item.cardId !== cardId),
    seen: round.seen.filter((id) => id !== cardId),
    learned: round.learned.filter((id) => id !== cardId),
    resolved: Object.fromEntries(
      Object.entries(round.resolved).filter(([id]) => id !== cardId),
    ),
  });
}

export function removeCurrentFromRound(round: RoundState): RoundState {
  const id = currentCardId(round);
  return id === null ? round : removeCardFromRound(round, id);
}

export function summarizeRound(round: RoundState): RoundSummary {
  const finalStatuses = round.deck
    .map((id) => round.resolved[id])
    .filter((status): status is CardStatus => status !== undefined);

  const finalCounts = emptyCounts();
  for (const status of finalStatuses) {
    finalCounts[status] += 1;
  }

  const successes = round.counts.easy;
  const failures = round.counts.hard;
  const attempts = successes + failures;

  return {
    seen: finalStatuses.length,
    total: round.deck.length,
    successes,
    failures,
    learned: round.learned.length,
    newCount: finalCounts.new,
    easyCount: finalCounts.easy,
    hardCount: finalCounts.hard,
    learnedCount: finalCounts.learned,
    accuracy: attempts === 0 ? 0 : successes / attempts,
  };
}

/**
 * Builds a new standard round with the cards from a finished round whose final
 * status is one of the selected ones.
 */
export function createReviewRound(
  cards: readonly StudyCard[],
  previous: RoundState,
  statuses: readonly CardStatus[],
  random: () => number = Math.random,
): RoundState {
  const selected = new Set(statuses);
  const ids = new Set(
    previous.deck.filter((id) => {
      const status = previous.resolved[id];
      return status !== undefined && selected.has(status);
    }),
  );

  return createRound(
    cards.filter((card) => ids.has(card.id)),
    "standard",
    random,
  );
}
