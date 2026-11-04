import { describe, expect, it } from "vitest";
import {
  DICTATION_HISTORY_LIMIT,
  canUndoDictation,
  createDictationHistory,
  currentDictationEntry,
  dictationUndoCount,
  pushDictationEntry,
  undoDictationHistory,
} from "./history";
import type { DictationEntry } from "./types";

function entry(id: string): DictationEntry {
  return {
    phrase: {
      id,
      sideA: `A ${id}`,
      sideB: `B ${id}`,
      direction: "en-es",
      scenarioCategory: "911",
      terms: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    warnings: [],
  };
}

describe("dictation history", () => {
  it("starts empty", () => {
    const history = createDictationHistory();

    expect(currentDictationEntry(history)).toBeNull();
    expect(canUndoDictation(history)).toBe(false);
    expect(dictationUndoCount(history)).toBe(0);
  });

  it("keeps only the last 20 phrases", () => {
    let history = createDictationHistory();

    for (let index = 0; index < DICTATION_HISTORY_LIMIT + 3; index += 1) {
      history = pushDictationEntry(history, entry(String(index)));
    }

    expect(history.entries).toHaveLength(DICTATION_HISTORY_LIMIT);
    expect(history.index).toBe(DICTATION_HISTORY_LIMIT - 1);
    expect(currentDictationEntry(history)?.phrase.id).toBe("22");
    expect(history.entries[0].phrase.id).toBe("3");
  });

  it("moves back one phrase at a time", () => {
    let history = createDictationHistory();
    history = pushDictationEntry(history, entry("1"));
    history = pushDictationEntry(history, entry("2"));
    history = pushDictationEntry(history, entry("3"));

    expect(canUndoDictation(history)).toBe(true);
    expect(dictationUndoCount(history)).toBe(2);

    history = undoDictationHistory(history);
    expect(currentDictationEntry(history)?.phrase.id).toBe("2");
    expect(dictationUndoCount(history)).toBe(1);

    history = undoDictationHistory(history);
    expect(currentDictationEntry(history)?.phrase.id).toBe("1");
    expect(canUndoDictation(history)).toBe(false);
    expect(undoDictationHistory(history)).toBe(history);
  });

  it("discards the forward branch when a new phrase is pushed", () => {
    let history = createDictationHistory();
    history = pushDictationEntry(history, entry("1"));
    history = pushDictationEntry(history, entry("2"));
    history = undoDictationHistory(history);
    history = pushDictationEntry(history, entry("3"));

    expect(history.entries.map((item) => item.phrase.id)).toEqual(["1", "3"]);
    expect(currentDictationEntry(history)?.phrase.id).toBe("3");
  });
});
