import { describe, expect, it } from "vitest";
import { createRound } from "./round";
import type { StudyCard } from "./types";
import {
  createSessionUndo,
  createUndoEntry,
  pushUndo,
  UNDO_LIMIT,
  undoAvailable,
  type SessionUndo,
} from "./undo";

function card(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "c1",
    category: "Insurance",
    termEng: "Policy",
    termEsp: "Póliza",
    description: "",
    status: "new",
    hidden: false,
    history: ["s", "f"],
    totalSuccess: 1,
    totalFail: 1,
    ...overrides,
  };
}

function round() {
  return createRound([card({ id: "c1" }), card({ id: "c2" })], "standard", () => 0.5);
}

describe("createUndoEntry", () => {
  it("snapshots the card state before the action", () => {
    const entry = createUndoEntry("status", card(), 1_000);

    expect(entry.kind).toBe("status");
    expect(entry.cardId).toBe("c1");
    expect(entry.at).toBe(1_000);
    expect(entry.snapshot).toMatchObject({
      id: "c1",
      history: ["s", "f"],
      totalSuccess: 1,
      totalFail: 1,
      status: "new",
      hidden: false,
    });
  });

  it("does not share the history array with the card", () => {
    const source = card();
    const entry = createUndoEntry("hide", source, 1_000);

    source.history.push("s");

    expect(entry.snapshot.history).toEqual(["s", "f"]);
  });
});

describe("createSessionUndo", () => {
  it("stores a clone of the round and the flip state", () => {
    const current = round();
    const undo = createSessionUndo("status", card(), current, true, 5_000);

    expect(undo.flipped).toBe(true);
    expect(undo.round).not.toBe(current);
    expect(undo.round.deck).toEqual(current.deck);

    const queued = undo.round.queue.length;
    current.queue.length = 0;
    expect(undo.round.queue).toHaveLength(queued);
  });
});

describe("pushUndo", () => {
  it("appends entries and keeps only the last 20", () => {
    let stack: SessionUndo[] = [];
    for (let index = 0; index < UNDO_LIMIT + 5; index += 1) {
      stack = pushUndo(
        stack,
        createSessionUndo("status", card(), round(), false, index),
      );
    }

    expect(stack).toHaveLength(UNDO_LIMIT);
    expect(stack[stack.length - 1].entry.at).toBe(UNDO_LIMIT + 4);
  });
});

describe("undoAvailable", () => {
  it("is false for an empty stack", () => {
    expect(undoAvailable([])).toBe(false);
  });

  it("is true when there is at least one entry", () => {
    const stack = pushUndo(
      [],
      createSessionUndo("status", card(), round(), false, 1_000),
    );
    expect(undoAvailable(stack)).toBe(true);
  });
});
