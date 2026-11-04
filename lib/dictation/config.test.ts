import { describe, expect, it } from "vitest";
import {
  DEFAULT_DICTATION_CONFIG,
  clampSilenceSeconds,
  languageForSide,
  mergeDictationConfig,
  normalizeDictationConfig,
  resolveDirection,
  scenarioCategories,
  termCountForLength,
} from "./config";

describe("normalizeDictationConfig", () => {
  it("returns the defaults for empty input", () => {
    expect(normalizeDictationConfig(null)).toEqual(DEFAULT_DICTATION_CONFIG);
  });

  it("clamps the silence limit to the supported range", () => {
    expect(clampSilenceSeconds(1)).toBe(3);
    expect(clampSilenceSeconds(45)).toBe(30);
    expect(clampSilenceSeconds(5.6)).toBe(6);
    expect(
      normalizeDictationConfig({ silenceSeconds: 99 }).silenceSeconds,
    ).toBe(30);
  });

  it("drops unknown categories and the General category", () => {
    const config = normalizeDictationConfig(
      { categories: ["911", "General", "Medical", "Deleted", "911"] },
      ["911", "Medical"],
    );

    expect(config.categories).toEqual(["911", "Medical"]);
  });

  it("keeps null as every category", () => {
    expect(normalizeDictationConfig({ categories: null }).categories).toBeNull();
  });

  it("keeps an intentionally empty status list", () => {
    expect(normalizeDictationConfig({ statuses: [] }).statuses).toEqual([]);
  });

  it("falls back on invalid enums", () => {
    const config = normalizeDictationConfig({
      direction: "up-down" as never,
      length: "huge" as never,
      speed: "warp" as never,
    });

    expect(config.direction).toBe("en-es");
    expect(config.length).toBe("short");
    expect(config.speed).toBe("normal");
  });
});

describe("mergeDictationConfig", () => {
  it("keeps current values for omitted fields", () => {
    const current = normalizeDictationConfig({
      length: "long",
      listenMode: true,
    });
    const merged = mergeDictationConfig(current, { speed: "fast" });

    expect(merged.length).toBe("long");
    expect(merged.listenMode).toBe(true);
    expect(merged.speed).toBe("fast");
  });
});

describe("scenarioCategories", () => {
  it("uses every known category when null", () => {
    expect(
      scenarioCategories({ categories: null }, ["911", "General", "Medical"]),
    ).toEqual(["911", "Medical"]);
  });

  it("never returns General as a scenario", () => {
    expect(
      scenarioCategories({ categories: ["General", "911"] }, []),
    ).toEqual(["911"]);
  });
});

describe("direction helpers", () => {
  it("returns the chosen direction", () => {
    expect(resolveDirection("en-es")).toBe("en-es");
    expect(resolveDirection("es-en")).toBe("es-en");
  });

  it("maps each side to its language", () => {
    expect(languageForSide("en-es", "A")).toBe("en");
    expect(languageForSide("en-es", "B")).toBe("es");
    expect(languageForSide("es-en", "A")).toBe("es");
    expect(languageForSide("es-en", "B")).toBe("en");
  });

  it("maps length to term count", () => {
    expect(termCountForLength("short")).toBe(3);
    expect(termCountForLength("medium")).toBe(4);
    expect(termCountForLength("long")).toBe(5);
  });
});
