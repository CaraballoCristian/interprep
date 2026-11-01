import { describe, expect, it } from "vitest";
import type { CardResult } from "../types";
import { buildDeck, cardWeight, weightedShuffle } from "./deck";
import type { StudyCard } from "./types";

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "c1",
    category: "Insurance",
    termEng: "Policy",
    termEsp: "Póliza",
    description: "",
    status: "new",
    hidden: false,
    history: [],
    totalSuccess: 0,
    totalFail: 0,
    ...overrides,
  };
}

function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildDeck", () => {
  const cards = [
    card({ id: "a", status: "new", category: "Insurance" }),
    card({ id: "b", status: "hard", category: "Court" }),
    card({ id: "c", status: "learned", category: "Insurance" }),
    card({ id: "d", status: "new", category: "Court", hidden: true }),
  ];

  it("excludes hidden cards", () => {
    const deck = buildDeck(cards, {
      categories: null,
      statuses: ["new", "hard", "learned"],
    });
    expect(deck.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("filters by status", () => {
    const deck = buildDeck(cards, {
      categories: null,
      statuses: ["new"],
    });
    expect(deck.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("filters by category", () => {
    const deck = buildDeck(cards, {
      categories: ["Court"],
      statuses: ["new", "hard", "learned"],
    });
    expect(deck.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("treats null categories as all categories", () => {
    const deck = buildDeck(cards, {
      categories: null,
      statuses: ["hard"],
    });
    expect(deck.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("returns an empty deck when nothing matches", () => {
    expect(
      buildDeck(cards, { categories: ["Medical"], statuses: ["new"] }),
    ).toEqual([]);
  });
});

describe("cardWeight", () => {
  it("is 1 plus the number of failures", () => {
    expect(cardWeight({ history: [] })).toBe(1);
    expect(cardWeight({ history: ["s", "f", "s"] })).toBe(2);
    expect(cardWeight({ history: ["f", "f", "f"] })).toBe(4);
  });

  it("only counts the last 10 results", () => {
    const old: CardResult[] = ["f", "f", "f", "f", "f"];
    const recent: CardResult[] = Array<CardResult>(10).fill("s");
    expect(cardWeight({ history: [...old, ...recent] })).toBe(1);
  });
});

describe("weightedShuffle", () => {
  it("includes every card exactly once", () => {
    const deck = Array.from({ length: 20 }, (_, index) =>
      card({ id: `c${index}` }),
    );

    for (let run = 0; run < 50; run += 1) {
      const shuffled = weightedShuffle(deck, seededRandom(run));
      expect(shuffled).toHaveLength(deck.length);
      expect(new Set(shuffled.map((entry) => entry.id)).size).toBe(
        deck.length,
      );
    }
  });

  it("does not mutate the input", () => {
    const deck = [card({ id: "a" }), card({ id: "b" })];
    const before = deck.map((entry) => entry.id);
    weightedShuffle(deck, seededRandom(1));
    expect(deck.map((entry) => entry.id)).toEqual(before);
  });

  it("places cards with more failures earlier on average", () => {
    const heavy = card({
      id: "heavy",
      history: Array<CardResult>(10).fill("f"),
    });
    const light = card({ id: "light", history: [] });
    const deck = [heavy, light];

    const random = seededRandom(42);
    const runs = 2_000;
    let heavyPosition = 0;

    for (let run = 0; run < runs; run += 1) {
      const shuffled = weightedShuffle(deck, random);
      heavyPosition += shuffled.findIndex((entry) => entry.id === "heavy");
    }

    expect(heavyPosition / runs).toBeLessThan(0.25);
  });
});
