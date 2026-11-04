import {
  DICTATION_TERMS_BY_LENGTH,
  type DictationLength,
  type DictationTerm,
  type ResolvedDirection,
} from "./types";

export type DictationPromptInput = {
  direction: ResolvedDirection;
  length: DictationLength;
  scenarioCategory: string;
  terms: readonly DictationTerm[];
};

/**
 * Compact prompt: it only carries the selected terms, the scenario and the
 * direction. No history, no full vocabulary and no examples, which keeps the
 * input tokens low.
 */
export function buildDictationPrompt(input: DictationPromptInput): string {
  const count = DICTATION_TERMS_BY_LENGTH[input.length];
  const source = input.direction === "en-es" ? "English" : "Spanish";
  const target = input.direction === "en-es" ? "Spanish" : "English";
  const glossary = input.terms
    .map((term, index) => `${index + 1}. ${term.termEng} | ${term.termEsp}`)
    .join("\n");

  return [
    "You write interpreter training phrases.",
    `Scenario: ${input.scenarioCategory}.`,
    `Side A language: ${source}. Side B language: ${target}.`,
    `Length: ${input.length}. Use exactly ${count} glossary pairs.`,
    "Glossary (English | Spanish):",
    glossary,
    "Rules: each pair exactly once and verbatim on its side, no inflection. Side B faithfully interprets side A. Natural speech, 1-2 sentences, fictional details.",
  ].join("\n");
}

/**
 * Gemini structured-output schema. Only the two sides are returned: the used
 * terms are known locally, so asking the model to echo them would waste output
 * tokens.
 */
export const DICTATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sideA: { type: "STRING" },
    sideB: { type: "STRING" },
  },
  required: ["sideA", "sideB"],
} as const;
