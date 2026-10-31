import { describe, expect, it } from "vitest";
import {
  dictionaries,
  interpolate,
  translate,
  type TranslationKey,
} from "./dictionary";

const esKeys = Object.keys(dictionaries.es).sort();
const enKeys = Object.keys(dictionaries.en).sort();

describe("dictionaries", () => {
  it("has the same keys in both languages", () => {
    expect(enKeys).toEqual(esKeys);
  });

  it("has no empty translations", () => {
    for (const language of ["es", "en"] as const) {
      for (const [key, value] of Object.entries(dictionaries[language])) {
        expect(value.trim(), `${language}:${key}`).not.toBe("");
      }
    }
  });

  it("keeps the same placeholders in both languages", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    for (const key of esKeys as TranslationKey[]) {
      expect(placeholders(dictionaries.en[key]), key).toEqual(
        placeholders(dictionaries.es[key]),
      );
    }
  });
});

describe("translate", () => {
  it("returns the Spanish source text", () => {
    expect(translate("es", "status.learning")).toBe("Aprendiendo");
  });

  it("returns the English text", () => {
    expect(translate("en", "status.learning")).toBe("Learning");
  });

  it("interpolates parameters", () => {
    expect(translate("es", "summary.cards", { seen: 3, total: 10 })).toBe(
      "3 de 10 tarjetas",
    );
    expect(translate("en", "summary.cards", { seen: 3, total: 10 })).toBe(
      "3 of 10 cards",
    );
  });

  it("interpolates repeated parameters", () => {
    expect(
      translate("en", "library.summary", {
        filtered: 2,
        total: 5,
        cards: "cards",
        hidden: 1,
        hiddenWord: "hidden",
      }),
    ).toBe("2 of 5 cards · 1 hidden");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("{known} {unknown}", { known: "x" })).toBe("x {unknown}");
  });

  it("returns the template unchanged without parameters", () => {
    expect(interpolate("{known}")).toBe("{known}");
  });
});
