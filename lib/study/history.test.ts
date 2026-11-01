import { describe, expect, it } from "vitest";
import type { CardResult } from "../types";
import { applyResultToCard, restoreCard, snapshotCard } from "./history";
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

describe("applyResultToCard", () => {
  it("appends the result and increments the matching counter", () => {
    const success = applyResultToCard(card(), "s");
    expect(success.history).toEqual(["s"]);
    expect(success.totalSuccess).toBe(1);
    expect(success.totalFail).toBe(0);

    const failure = applyResultToCard(card(), "f");
    expect(failure.history).toEqual(["f"]);
    expect(failure.totalSuccess).toBe(0);
    expect(failure.totalFail).toBe(1);
  });

  it("does not mutate the original card", () => {
    const original = card();
    applyResultToCard(original, "s");
    expect(original.history).toEqual([]);
    expect(original.totalSuccess).toBe(0);
  });

  it("keeps only the last 10 results", () => {
    const history: CardResult[] = ["s", "f", "s", "f", "s", "f", "s", "f", "s", "f"];
    const updated = applyResultToCard(card({ history }), "s");

    expect(updated.history).toHaveLength(10);
    expect(updated.history).toEqual([...history.slice(1), "s"]);
  });
});

describe("snapshotCard / restoreCard", () => {
  it("restores the exact previous state", () => {
    const before = card({
      history: ["s", "f", "s"],
      totalSuccess: 2,
      totalFail: 1,
      status: "hard",
      hidden: false,
    });
    const snapshot = snapshotCard(before);
    const after = applyResultToCard(before, "f");
    const restored = restoreCard(after, snapshot);

    expect(restored).toMatchObject({
      history: ["s", "f", "s"],
      totalSuccess: 2,
      totalFail: 1,
      status: "hard",
      hidden: false,
    });
  });

  it("restores a truncated history exactly", () => {
    const history: CardResult[] = ["s", "f", "s", "f", "s", "f", "s", "f", "s", "f"];
    const before = card({ history, totalSuccess: 5, totalFail: 5 });
    const snapshot = snapshotCard(before);
    const after = applyResultToCard(before, "s");

    expect(after.history).not.toEqual(history);

    const restored = restoreCard(after, snapshot);
    expect(restored.history).toEqual(history);
    expect(restored.totalSuccess).toBe(5);
    expect(restored.totalFail).toBe(5);
  });

  it("snapshots are independent copies", () => {
    const before = card({ history: ["s"] });
    const snapshot = snapshotCard(before);
    before.history.push("f");
    expect(snapshot.history).toEqual(["s"]);
  });
});
