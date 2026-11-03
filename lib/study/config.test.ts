import { describe, expect, it } from "vitest";
import { toggleSideField } from "./config";
import type { StudyConfig } from "./types";

function config(sideA: StudyConfig["sideA"], sideB: StudyConfig["sideB"]): StudyConfig {
  return {
    sideA,
    sideB,
    categories: ["Insurance"],
    deckIds: null,
    statuses: ["new", "hard"],
    continuous: false,
  };
}

describe("toggleSideField", () => {
  it("adds a field that is on neither side", () => {
    const next = toggleSideField(config([], []), "sideA", "termEng");

    expect(next.sideA).toEqual(["termEng"]);
    expect(next.sideB).toEqual([]);
  });

  it("adds a field to side B", () => {
    const next = toggleSideField(config([], []), "sideB", "description");

    expect(next.sideA).toEqual([]);
    expect(next.sideB).toEqual(["description"]);
  });

  it("moves a field from A to B in one step", () => {
    const next = toggleSideField(config(["termEng"], []), "sideB", "termEng");

    expect(next.sideA).toEqual([]);
    expect(next.sideB).toEqual(["termEng"]);
  });

  it("moves a field from B to A in one step", () => {
    const next = toggleSideField(config([], ["termEsp"]), "sideA", "termEsp");

    expect(next.sideA).toEqual(["termEsp"]);
    expect(next.sideB).toEqual([]);
  });

  it("removes a field from A when clicking A again", () => {
    const next = toggleSideField(config(["termEng"], []), "sideA", "termEng");

    expect(next.sideA).toEqual([]);
    expect(next.sideB).toEqual([]);
  });

  it("removes a field from B when clicking B again", () => {
    const next = toggleSideField(config([], ["description"]), "sideB", "description");

    expect(next.sideA).toEqual([]);
    expect(next.sideB).toEqual([]);
  });

  it("keeps the other fields of the target side", () => {
    const next = toggleSideField(
      config(["termEng"], ["termEsp"]),
      "sideB",
      "termEng",
    );

    expect(next.sideA).toEqual([]);
    expect(next.sideB).toEqual(["termEsp", "termEng"]);
  });

  it("does not change categories, decks or statuses", () => {
    const next = toggleSideField(config([], []), "sideA", "termEng");

    expect(next.categories).toEqual(["Insurance"]);
    expect(next.deckIds).toBeNull();
    expect(next.statuses).toEqual(["new", "hard"]);
  });

  it("does not mutate the input config", () => {
    const input = config(["termEng"], []);
    toggleSideField(input, "sideB", "termEng");

    expect(input.sideA).toEqual(["termEng"]);
    expect(input.sideB).toEqual([]);
  });
});
