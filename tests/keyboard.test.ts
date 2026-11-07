import { describe, expect, it } from "vitest";
import { matchesShortcut } from "../src/config/keyboard";

function event(
  key: string,
  overrides: Partial<
    Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey">
  > = {},
) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  };
}

describe("study keyboard shortcuts", () => {
  it("maps numpad 0 and R to audio playback", () => {
    expect(matchesShortcut(event("0"), "audio")).toBe(true);
    expect(matchesShortcut(event("r"), "audio")).toBe(true);
    expect(matchesShortcut(event("R"), "audio")).toBe(true);
  });

  it("ignores audio shortcuts when a modifier is held", () => {
    expect(matchesShortcut(event("r", { ctrlKey: true }), "audio")).toBe(false);
    expect(matchesShortcut(event("0", { metaKey: true }), "audio")).toBe(false);
    expect(matchesShortcut(event("R", { altKey: true }), "audio")).toBe(false);
  });

  it("does not treat other keys as audio", () => {
    expect(matchesShortcut(event("h"), "audio")).toBe(false);
    expect(matchesShortcut(event(" "), "audio")).toBe(false);
  });

  it("maps WASD to the arrow-key actions", () => {
    expect(matchesShortcut(event("w"), "learned")).toBe(true);
    expect(matchesShortcut(event("W"), "learned")).toBe(true);
    expect(matchesShortcut(event("a"), "hard")).toBe(true);
    expect(matchesShortcut(event("A"), "hard")).toBe(true);
    expect(matchesShortcut(event("s"), "new")).toBe(true);
    expect(matchesShortcut(event("S"), "new")).toBe(true);
    expect(matchesShortcut(event("d"), "easy")).toBe(true);
    expect(matchesShortcut(event("D"), "easy")).toBe(true);
  });

  it("keeps the arrow keys working alongside WASD", () => {
    expect(matchesShortcut(event("ArrowUp"), "learned")).toBe(true);
    expect(matchesShortcut(event("ArrowLeft"), "hard")).toBe(true);
    expect(matchesShortcut(event("ArrowDown"), "new")).toBe(true);
    expect(matchesShortcut(event("ArrowRight"), "easy")).toBe(true);
  });

  it("ignores WASD when a modifier is held", () => {
    expect(matchesShortcut(event("a", { ctrlKey: true }), "hard")).toBe(false);
    expect(
      matchesShortcut(event("w", { metaKey: true }), "learned"),
    ).toBe(false);
    expect(matchesShortcut(event("s", { altKey: true }), "new")).toBe(false);
    expect(matchesShortcut(event("d", { ctrlKey: true }), "easy")).toBe(false);
  });
});
