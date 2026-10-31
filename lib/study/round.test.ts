import { describe, expect, it } from "vitest";
import {
  createReviewRound,
  createRound,
  currentCardId,
  isRoundComplete,
  recordRoundResult,
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

describe("createRound", () => {
  it("includes every deck card exactly once", () => {
    const cards = [card("a"), card("b"), card("c")];
    const round = createRound(cards);

    expect(round.order).toHaveLength(3);
    expect(new Set(round.order)).toEqual(new Set(["a", "b", "c"]));
    expect(round.index).toBe(0);
    expect(round.results).toEqual({});
    expect(round.seen).toEqual([]);
    expect(round.failed).toEqual([]);
  });

  it("starts at the first card of the order", () => {
    const round = createRound([card("a"), card("b")], fixedRandom(0.5));
    expect(currentCardId(round)).toBe(round.order[0]);
    expect(isRoundComplete(round)).toBe(false);
  });

  it("supports an empty deck", () => {
    const round = createRound([]);
    expect(currentCardId(round)).toBeNull();
    expect(isRoundComplete(round)).toBe(true);
  });
});

describe("recordRoundResult", () => {
  it("records the current card and advances", () => {
    const round = createRound([card("a"), card("b")], fixedRandom(0.5));
    const [first, second] = round.order;

    const next = recordRoundResult(round, first, "s");

    expect(next.index).toBe(1);
    expect(next.results[first]).toBe("s");
    expect(next.seen).toEqual([first]);
    expect(next.failed).toEqual([]);
    expect(currentCardId(next)).toBe(second);
  });

  it("tracks failures for the review round", () => {
    const round = createRound([card("a"), card("b")], fixedRandom(0.5));
    const [first, second] = round.order;

    const afterFirst = recordRoundResult(round, first, "f");
    const afterSecond = recordRoundResult(afterFirst, second, "f");

    expect(afterSecond.failed).toEqual([first, second]);
    expect(isRoundComplete(afterSecond)).toBe(true);
  });

  it("ignores results for cards that are not current", () => {
    const round = createRound([card("a"), card("b")], fixedRandom(0.5));
    const [first, second] = round.order;

    expect(recordRoundResult(round, second, "s")).toBe(round);
    expect(recordRoundResult(round, "unknown", "s")).toBe(round);
  });

  it("does not repeat a card within the same round", () => {
    const cards = [card("a"), card("b"), card("c")];
    let round = createRound(cards);

    while (!isRoundComplete(round)) {
      const id = currentCardId(round);
      expect(id).not.toBeNull();
      expect(round.seen).not.toContain(id);
      round = recordRoundResult(round, id as string, "s");
    }

    expect(round.seen).toHaveLength(cards.length);
    expect(new Set(round.seen).size).toBe(cards.length);
  });
});

describe("removeCurrentFromRound", () => {
  it("removes the current card and points to the next one", () => {
    const round = createRound([card("a"), card("b"), card("c")], fixedRandom(0.5));
    const [first, second] = round.order;

    const next = removeCurrentFromRound(round);

    expect(next.order).not.toContain(first);
    expect(currentCardId(next)).toBe(second);
    expect(next.index).toBe(0);
  });

  it("does nothing when the round is complete", () => {
    const round = createRound([]);
    expect(removeCurrentFromRound(round)).toBe(round);
  });
});

describe("summarizeRound", () => {
  it("counts seen cards, successes, failures and accuracy", () => {
    const round = createRound([card("a"), card("b"), card("c")], fixedRandom(0.5));
    const [first, second, third] = round.order;

    let current = recordRoundResult(round, first, "s");
    current = recordRoundResult(current, second, "f");
    current = recordRoundResult(current, third, "s");

    expect(summarizeRound(current)).toEqual({
      seen: 3,
      successes: 2,
      failures: 1,
      accuracy: 2 / 3,
    });
  });

  it("returns zero accuracy for an empty round", () => {
    expect(summarizeRound(createRound([]))).toEqual({
      seen: 0,
      successes: 0,
      failures: 0,
      accuracy: 0,
    });
  });
});

describe("createReviewRound", () => {
  it("contains only the failed cards", () => {
    const cards = [card("a"), card("b"), card("c")];
    const review = createReviewRound(cards, ["a", "c"], fixedRandom(0.5));

    expect(new Set(review.order)).toEqual(new Set(["a", "c"]));
    expect(review.order).toHaveLength(2);
  });

  it("is empty when nothing failed", () => {
    const review = createReviewRound([card("a")], []);
    expect(review.order).toEqual([]);
  });

  it("ignores failed ids that are not in the deck", () => {
    const review = createReviewRound([card("a")], ["a", "missing"]);
    expect(review.order).toEqual(["a"]);
  });
});
