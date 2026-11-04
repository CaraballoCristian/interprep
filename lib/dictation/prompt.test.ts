import { describe, expect, it } from "vitest";
import { buildDictationPrompt } from "./prompt";
import type { DictationTerm } from "./types";

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

describe("buildDictationPrompt", () => {
  it("includes only the selected terms and the requested direction", () => {
    const prompt = buildDictationPrompt({
      direction: "en-es",
      length: "short",
      scenarioCategory: "911",
      terms,
    });

    expect(prompt).toContain("Scenario: 911");
    expect(prompt).toContain("Side A language: English");
    expect(prompt).toContain("Side B language: Spanish");
    expect(prompt).toContain("exactly 3 glossary pairs");
    expect(prompt).toContain("emergency | emergencia");
    expect(prompt).toContain("ambulance | ambulancia");
    expect(prompt).toContain("help | ayuda");
  });

  it("switches the languages for the reverse direction", () => {
    const prompt = buildDictationPrompt({
      direction: "es-en",
      length: "long",
      scenarioCategory: "Medical",
      terms,
    });

    expect(prompt).toContain("Side A language: Spanish");
    expect(prompt).toContain("Side B language: English");
    expect(prompt).toContain("exactly 5 glossary pairs");
  });
});
