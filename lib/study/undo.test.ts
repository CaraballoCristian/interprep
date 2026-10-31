import { describe, expect, it } from "vitest";
import {
  createUndoEntry,
  isUndoAvailable,
  markResolution,
  UNDO_MAX_RESOLUTIONS,
  UNDO_WINDOW_MS,
} from "./undo";
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
    history: ["s", "f"],
    totalSuccess: 1,
    totalFail: 1,
    ...overrides,
  };
}

describe("createUndoEntry", () => {
  it("snapshots the card state before the action", () => {
    const entry = createUndoEntry("result", card(), 1_000);

    expect(entry.kind).toBe("result");
    expect(entry.cardId).toBe("c1");
    expect(entry.at).toBe(1_000);
    expect(entry.resolutionsAfter).toBe(0);
    expect(entry.snapshot).toMatchObject({
      id: "c1",
      history: ["s", "f"],
      totalSuccess: 1,
      totalFail: 1,
      status: "new",
      hidden: false,
    });
  });
});

describe("isUndoAvailable", () => {
  it("is false without an entry", () => {
    expect(isUndoAvailable(null, 1_000)).toBe(false);
  });

  it("is available within the time window", () => {
    const entry = createUndoEntry("result", card(), 1_000);
    expect(isUndoAvailable(entry, 1_000)).toBe(true);
    expect(isUndoAvailable(entry, 1_000 + UNDO_WINDOW_MS - 1)).toBe(true);
  });

  it("expires after the time window", () => {
    const entry = createUndoEntry("result", card(), 1_000);
    expect(isUndoAvailable(entry, 1_000 + UNDO_WINDOW_MS)).toBe(false);
  });

  it("expires after three more resolutions", () => {
    let entry = createUndoEntry("result", card(), 1_000);

    entry = markResolution(entry) as typeof entry;
    entry = markResolution(entry) as typeof entry;
    expect(isUndoAvailable(entry, 1_001)).toBe(true);

    entry = markResolution(entry) as typeof entry;
    expect(entry.resolutionsAfter).toBe(UNDO_MAX_RESOLUTIONS);
    expect(isUndoAvailable(entry, 1_001)).toBe(false);
  });

  it("markResolution is null-safe", () => {
    expect(markResolution(null)).toBeNull();
  });
});
