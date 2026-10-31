import { describe, expect, it } from "vitest";
import { matchKey, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("trims, lowercases, strips accents and collapses whitespace", () => {
    expect(normalizeText("  Término   Inglés ")).toBe("termino ingles");
    expect(normalizeText("Descripción")).toBe("descripcion");
    expect(normalizeText("A\u0301rbol")).toBe("arbol");
  });

  it("keeps punctuation that is part of the term", () => {
    expect(normalizeText("911 (emergency)")).toBe("911 (emergency)");
  });
});

describe("matchKey", () => {
  it("matches cards that only differ in case, accents or spacing", () => {
    expect(matchKey("Policy", "Póliza")).toBe(matchKey("policy", "poliza"));
    expect(matchKey("  term  eng ", "término  esp")).toBe(
      matchKey("Term Eng", "termino esp"),
    );
  });

  it("does not match different terms", () => {
    expect(matchKey("Policy", "Póliza")).not.toBe(
      matchKey("Policy", "Prima"),
    );
  });

  it("separates the two sides to avoid ambiguity", () => {
    expect(matchKey("a", "b c")).not.toBe(matchKey("a b", "c"));
  });
});
