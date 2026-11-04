import { describe, expect, it } from "vitest";
import type { DictationTerm } from "./types";
import { validateDictationPhrase } from "./validate";

const terms: DictationTerm[] = [
  {
    cardId: "1",
    category: "911",
    termEng: "emergency",
    termEsp: "emergencia",
  },
  {
    cardId: "2",
    category: "911",
    termEng: "ambulance",
    termEsp: "ambulancia",
  },
  {
    cardId: "3",
    category: "General",
    termEng: "help",
    termEsp: "ayuda",
  },
];

describe("validateDictationPhrase", () => {
  it("accepts a phrase that uses every pair on the right side", () => {
    const result = validateDictationPhrase(
      {
        sideA: "This is an emergency. Send an ambulance and help us.",
        sideB: "Esto es una emergencia. Envíen una ambulancia y ayuda.",
      },
      terms,
      "en-es",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.terms).toEqual(terms);
  });

  it("works in the Spanish -> English direction", () => {
    const result = validateDictationPhrase(
      {
        sideA: "Es una emergencia. Necesitamos una ambulancia y ayuda.",
        sideB: "It is an emergency. We need an ambulance and help.",
      },
      terms,
      "es-en",
    );

    expect(result.ok).toBe(true);
  });

  it("rejects a translation that does not appear on side B", () => {
    const result = validateDictationPhrase(
      {
        sideA: "This is an emergency. Send an ambulance and help us.",
        sideB: "Esto es una emergencia. Envíen una ambulancia.",
      },
      terms,
      "en-es",
    );

    expect(result).toEqual({ ok: false, reason: "missing_term" });
  });

  it("rejects a source term that does not appear on side A", () => {
    const result = validateDictationPhrase(
      {
        sideA: "This is an emergency. Send an ambulance.",
        sideB: "Esto es una emergencia. Envíen una ambulancia y ayuda.",
      },
      terms,
      "en-es",
    );

    expect(result).toEqual({ ok: false, reason: "missing_term" });
  });

  it("rejects malformed JSON shapes", () => {
    expect(
      validateDictationPhrase({ sideA: "", sideB: "" }, terms, "en-es"),
    ).toEqual({ ok: false, reason: "invalid_shape" });
  });

  it("rejects an empty selection", () => {
    expect(
      validateDictationPhrase(
        { sideA: "Anything", sideB: "Cualquier cosa" },
        [],
        "en-es",
      ),
    ).toEqual({ ok: false, reason: "wrong_terms" });
  });
});
