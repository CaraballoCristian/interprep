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
});
