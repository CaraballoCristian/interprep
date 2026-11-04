import { describe, expect, it } from "vitest";
import type { DictationCard, DictationConfig } from "./types";
import { selectDictationTerms } from "./terms";

function card(
  id: string,
  category: string,
  termEng: string,
  termEsp: string,
  overrides: Partial<DictationCard> = {},
): DictationCard {
  return {
    id,
    category,
    termEng,
    termEsp,
    status: "new",
    hidden: false,
    ...overrides,
  };
}

function config(overrides: Partial<DictationConfig> = {}): DictationConfig {
  return {
    categories: null,
    includeGeneral: true,
    statuses: ["new", "easy", "hard"],
    direction: "en-es",
    length: "short",
    autoplay: true,
    listenMode: false,
    speed: "normal",
    silenceSeconds: 5,
    ...overrides,
  };
}

const cards: DictationCard[] = [
  card("e1", "911", "emergency", "emergencia"),
  card("e2", "911", "ambulance", "ambulancia"),
  card("e3", "911", "address", "dirección"),
  card("m1", "Medical", "chest pain", "dolor de pecho"),
  card("m2", "Medical", "blood pressure", "presión arterial"),
  card("m3", "Medical", "surgery", "cirugía"),
  card("g1", "General", "help", "ayuda"),
  card("g2", "General", "today", "hoy"),
  card("g3", "General", "family", "familia"),
];

describe("selectDictationTerms", () => {
  it("picks one scenario and supplements it with General", () => {
    const result = selectDictationTerms(cards, config(), () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.scenarioCategory).toBe("911");
    expect(result.terms).toHaveLength(3);
    expect(
      result.terms.every(
        (term) => term.category === "911" || term.category === "General",
      ),
    ).toBe(true);
  });

  it("never mixes two scenario categories", () => {
    const result = selectDictationTerms(
      cards,
      config({ categories: ["911", "Medical"] }),
      () => 0.99,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const categories = new Set(result.terms.map((term) => term.category));
    expect(categories.size).toBeLessThanOrEqual(2);
    expect(
      [...categories].filter((category) => category !== "General"),
    ).toHaveLength(1);
  });

  it("excludes General when it is unchecked", () => {
    const result = selectDictationTerms(
      cards,
      config({ includeGeneral: false }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.terms.every((term) => term.category === "911")).toBe(true);
  });

  it("excludes hidden cards and unselected statuses", () => {
    const filtered = [
      ...cards,
      card("x", "911", "hidden", "oculto", { hidden: true }),
      card("y", "911", "learned", "aprendido", { status: "learned" }),
    ];

    const result = selectDictationTerms(filtered, config(), () => 0);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.terms.some((term) => term.termEng === "hidden")).toBe(false);
    expect(result.terms.some((term) => term.termEng === "learned")).toBe(false);
  });

  it("warns about a selected category without eligible terms", () => {
    const result = selectDictationTerms(
      cards,
      config({ categories: ["911", "Fire"] }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.warnings).toContainEqual({
      code: "category_empty",
      category: "Fire",
    });
  });

  it("fails clearly when nothing matches", () => {
    const result = selectDictationTerms(
      cards,
      config({ categories: ["Fire"], includeGeneral: false }),
      () => 0,
    );

    expect(result).toEqual({
      ok: false,
      code: "no_eligible_terms",
      warnings: [{ code: "category_empty", category: "Fire" }],
      available: 0,
      required: 3,
    });
  });

  it("fails when there are fewer than three terms", () => {
    const result = selectDictationTerms(
      [card("a", "911", "one", "uno"), card("b", "911", "two", "dos")],
      config({ includeGeneral: false }),
      () => 0,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe("not_enough_terms");
    expect(result.available).toBe(2);
    expect(result.required).toBe(3);
  });

  it("uses General alone when no scenario category is available", () => {
    const generalOnly = cards.filter((item) => item.category === "General");
    const result = selectDictationTerms(
      generalOnly,
      config({ categories: [] }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.scenarioCategory).toBe("General");
    expect(result.terms).toHaveLength(3);
  });

  it("asks for four and five terms on longer phrases", () => {
    const medium = selectDictationTerms(
      cards,
      config({ length: "medium" }),
      () => 0,
    );
    const long = selectDictationTerms(
      cards,
      config({ length: "long" }),
      () => 0,
    );

    expect(medium.ok && medium.terms).toHaveLength(4);
    expect(long.ok && long.terms).toHaveLength(5);
  });

  it("deduplicates cards with the same term pair", () => {
    const duplicated = [
      ...cards,
      card("dup", "911", "emergency", "emergencia"),
    ];
    const result = selectDictationTerms(
      duplicated,
      config({ length: "long" }),
      () => 0,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const pairs = new Set(
      result.terms.map((term) => `${term.termEng}|${term.termEsp}`),
    );
    expect(pairs.size).toBe(result.terms.length);
  });
});
