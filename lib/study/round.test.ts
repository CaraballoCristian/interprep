import { describe, expect, it } from "vitest";
import {
  createReviewRound,
  createRound,
  currentCardId,
  HARD_DELAY_MAX,
  HARD_DELAY_MIN,
  isRoundComplete,
  NEW_DELAY_MAX,
  NEW_DELAY_MIN,
  recordStatus,
  refillRound,
  removeCurrentFromRound,
  summarizeRound,
} from "./round";
import type { StudyCard } from "./types";

function card(id: string, overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id,
    category: "Insurance",
    termEng: id,
    termEsp: id,
    description: "",
    status: "new",
    hidden: false,
    history: [],
    totalSuccess: 0,
    totalFail: 0,
    ...overrides,
  };
}

function fixedRandom(value: number): () => number {
  return () => value;
}

const ALL_SELECTED = ["new", "easy", "hard", "learned"] as const;

describe("createRound", () => {
  it("includes every deck card exactly once in the queue", () => {
    const cards = [card("a"), card("b"), card("c")];
    const round = createRound(cards, "standard", fixedRandom(0.5));

    expect(round.deck).toHaveLength(3);
    expect(new Set(round.deck)).toEqual(new Set(["a", "b", "c"]));
    expect(round.queue).toEqual(round.deck);
    expect(round.pending).toEqual([]);
    expect(round.answered).toBe(0);
    expect(round.seen).toEqual([]);
    expect(round.resolved).toEqual({});
    expect(round.mode).toBe("standard");
  });

  it("starts at the first card of the queue", () => {
    const round = createRound([card("a"), card("b")], "standard", fixedRandom(0.5));
    expect(currentCardId(round)).toBe(round.deck[0]);
    expect(isRoundComplete(round)).toBe(false);
  });

  it("supports an empty deck", () => {
    const round = createRound([]);
    expect(currentCardId(round)).toBeNull();
    expect(isRoundComplete(round)).toBe(true);
  });

  it("uses continuous mode when requested", () => {
    expect(createRound([card("a")], "continuous").mode).toBe("continuous");
  });
});

describe("recordStatus", () => {
  it("records the current card and advances", () => {
    const round = createRound([card("a"), card("b")], "standard", fixedRandom(0.5));
    const [first, second] = round.deck;

    const next = recordStatus(round, first, "easy", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(next.answered).toBe(1);
    expect(next.resolved[first]).toBe("easy");
    expect(next.seen).toEqual([first]);
    expect(next.counts.easy).toBe(1);
    expect(currentCardId(next)).toBe(second);
  });

  it("ignores statuses for cards that are not current", () => {
    const round = createRound([card("a"), card("b")], "standard", fixedRandom(0.5));
    const second = round.deck[1];

    expect(
      recordStatus(round, second, "easy", { selectedStatuses: ALL_SELECTED }),
    ).toBe(round);
    expect(
      recordStatus(round, "unknown", "easy", {
        selectedStatuses: ALL_SELECTED,
      }),
    ).toBe(round);
  });

  it("schedules a NEW repeat after the minimum delay", () => {
    const round = createRound([card("a"), card("b")], "standard", fixedRandom(0));
    const [first] = round.deck;

    const next = recordStatus(round, first, "new", {
      selectedStatuses: ALL_SELECTED,
      random: fixedRandom(0),
    });

    expect(next.pending).toEqual([
      { cardId: first, dueAt: 1 + NEW_DELAY_MIN - 1 },
    ]);
  });

  it("schedules a NEW repeat after the maximum delay", () => {
    const round = createRound([card("a"), card("b")], "standard");
    const first = round.deck[0];

    const next = recordStatus(round, first, "new", {
      selectedStatuses: ALL_SELECTED,
      random: fixedRandom(0.999999),
    });

    expect(next.pending[0].dueAt).toBe(NEW_DELAY_MAX);
  });

  it("does not repeat HARD in standard mode", () => {
    const round = createRound([card("a"), card("b")], "standard");
    const first = round.deck[0];

    const next = recordStatus(round, first, "hard", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(next.pending).toEqual([]);
  });

  it("repeats HARD in continuous mode within the 20-30 range", () => {
    const round = createRound([card("a"), card("b")], "continuous");
    const first = round.deck[0];

    const next = recordStatus(round, first, "hard", {
      selectedStatuses: ALL_SELECTED,
      random: fixedRandom(0),
    });

    expect(next.pending).toEqual([
      { cardId: first, dueAt: 1 + HARD_DELAY_MIN - 1 },
    ]);

    const late = recordStatus(round, first, "hard", {
      selectedStatuses: ALL_SELECTED,
      random: fixedRandom(0.999999),
    });
    expect(late.pending[0].dueAt).toBe(HARD_DELAY_MAX);
  });

  it("does not repeat EASY or LEARNED", () => {
    const round = createRound([card("a"), card("b")], "continuous");

    const easy = recordStatus(round, round.deck[0], "easy", {
      selectedStatuses: ALL_SELECTED,
    });
    expect(easy.pending).toEqual([]);

    const learned = recordStatus(round, round.deck[0], "learned", {
      selectedStatuses: ALL_SELECTED,
    });
    expect(learned.pending).toEqual([]);
  });

  it("drops a card from a continuous round when its status is filtered out", () => {
    const round = createRound([card("a"), card("b")], "continuous");

    const next = recordStatus(round, round.deck[0], "easy", {
      selectedStatuses: ["new", "hard"],
    });

    expect(next.deck).not.toContain(round.deck[0]);
  });

  it("keeps a filtered-out card in a standard round", () => {
    const round = createRound([card("a"), card("b")], "standard");

    const next = recordStatus(round, round.deck[0], "easy", {
      selectedStatuses: ["new", "hard"],
    });

    expect(next.deck).toContain(round.deck[0]);
  });
});

describe("refillRound", () => {
  it("moves due repeats into the queue", () => {
    const round = createRound([card("a"), card("b")], "standard");
    round.pending = [{ cardId: "a", dueAt: 1 }];
    round.answered = 1;

    const next = refillRound(round);

    expect(next.queue).toContain("a");
    expect(next.pending).toEqual([]);
  });

  it("flushes every pending card when the queue is empty", () => {
    const round = createRound([card("a")], "standard");
    round.queue = [];
    round.pending = [
      { cardId: "a", dueAt: 99 },
      { cardId: "b", dueAt: 50 },
    ];

    const next = refillRound(round);

    expect(next.queue).toEqual(["b", "a"]);
    expect(next.pending).toEqual([]);
  });
});

describe("isRoundComplete", () => {
  it("completes a standard round after a single pass", () => {
    let round = createRound([card("a"), card("b")], "standard");
    round = recordStatus(round, currentCardId(round) as string, "hard", {
      selectedStatuses: ALL_SELECTED,
    });
    round = recordStatus(round, currentCardId(round) as string, "easy", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(isRoundComplete(round)).toBe(true);
  });

  it("does not complete a continuous round until every card is EASY or LEARNED", () => {
    let round = createRound([card("a"), card("b")], "continuous");
    round = recordStatus(round, currentCardId(round) as string, "easy", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(isRoundComplete(round)).toBe(false);

    round = recordStatus(round, currentCardId(round) as string, "learned", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(isRoundComplete(round)).toBe(true);
  });

  it("never ends while a repeat is still pending", () => {
    let round = createRound([card("a")], "standard");
    round = recordStatus(round, "a", "new", {
      selectedStatuses: ALL_SELECTED,
      random: fixedRandom(0),
    });

    expect(round.queue).toEqual(["a"]);
    expect(isRoundComplete(round)).toBe(false);

    round = recordStatus(round, "a", "easy", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(isRoundComplete(round)).toBe(true);
  });
});

describe("removeCurrentFromRound", () => {
  it("removes the current card and points to the next one", () => {
    const round = createRound([card("a"), card("b"), card("c")], "standard", fixedRandom(0.5));
    const [first, second] = round.deck;

    const next = removeCurrentFromRound(round);

    expect(next.deck).not.toContain(first);
    expect(next.queue).not.toContain(first);
    expect(currentCardId(next)).toBe(second);
  });

  it("does nothing when the round is complete", () => {
    const round = createRound([]);
    expect(removeCurrentFromRound(round)).toBe(round);
  });
});

describe("summarizeRound", () => {
  it("counts seen cards, answers, final statuses and accuracy", () => {
    let round = createRound([card("a"), card("b"), card("c")], "standard", fixedRandom(0.5));
    const [first, second, third] = round.deck;

    round = recordStatus(round, first, "easy", { selectedStatuses: ALL_SELECTED });
    round = recordStatus(round, second, "hard", { selectedStatuses: ALL_SELECTED });
    round = recordStatus(round, third, "easy", { selectedStatuses: ALL_SELECTED });

    expect(summarizeRound(round)).toEqual({
      seen: 3,
      total: 3,
      successes: 2,
      failures: 1,
      learned: 0,
      newCount: 0,
      easyCount: 2,
      hardCount: 1,
      learnedCount: 0,
      accuracy: 2 / 3,
    });
  });

  it("returns zero accuracy for an empty round", () => {
    expect(summarizeRound(createRound([]))).toEqual({
      seen: 0,
      total: 0,
      successes: 0,
      failures: 0,
      learned: 0,
      newCount: 0,
      easyCount: 0,
      hardCount: 0,
      learnedCount: 0,
      accuracy: 0,
    });
  });

  it("tracks learned cards", () => {
    let round = createRound([card("a"), card("b")], "standard");
    round = recordStatus(round, round.deck[0], "learned", {
      selectedStatuses: ALL_SELECTED,
    });

    expect(summarizeRound(round).learned).toBe(1);
    expect(summarizeRound(round).learnedCount).toBe(1);
  });
});

describe("createReviewRound", () => {
  it("contains only the cards with the selected final statuses", () => {
    const cards = [card("a"), card("b"), card("c")];
    let round = createRound(cards, "standard", fixedRandom(0.5));
    const [first, second, third] = round.deck;
    round = recordStatus(round, first, "easy", { selectedStatuses: ALL_SELECTED });
    round = recordStatus(round, second, "hard", { selectedStatuses: ALL_SELECTED });
    round = recordStatus(round, third, "learned", { selectedStatuses: ALL_SELECTED });

    const review = createReviewRound(
      cards,
      round,
      ["hard", "learned"],
      fixedRandom(0.5),
    );

    expect(new Set(review.deck)).toEqual(new Set([second, third]));
    expect(review.mode).toBe("standard");
  });

  it("is empty when no card matches", () => {
    const review = createReviewRound([card("a")], createRound([], "standard"), [
      "hard",
    ]);
    expect(review.deck).toEqual([]);
  });
});
