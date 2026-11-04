import { z } from "zod";
import { matchKey, normalizeText } from "../normalize";
import type {
  DictationTerm,
  ResolvedDirection,
} from "./types";

/**
 * The model only returns the two sides. The glossary is already known locally,
 * so echoing it would cost output tokens for no benefit.
 */
export const geminiPhraseSchema = z.object({
  sideA: z.string().trim().min(1).max(2_000),
  sideB: z.string().trim().min(1).max(2_000),
});

export type GeminiPhrase = z.infer<typeof geminiPhraseSchema>;

export type PhraseValidation =
  | {
      ok: true;
      sideA: string;
      sideB: string;
      terms: DictationTerm[];
    }
  | {
      ok: false;
      reason: "invalid_shape" | "wrong_terms" | "missing_term";
    };

/**
 * Hard gate for the model output. It guarantees that every requested pair
 * appears verbatim on its side of the phrase, which is what the exercise
 * requires.
 *
 * There is deliberately no visual highlighting in the UI; this check only
 * protects the quality of the generated phrase.
 */
export function validateDictationPhrase(
  raw: unknown,
  selected: readonly DictationTerm[],
  direction: ResolvedDirection,
): PhraseValidation {
  const parsed = geminiPhraseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape" };
  }

  if (selected.length === 0) {
    return { ok: false, reason: "wrong_terms" };
  }

  const sideA = normalizeText(parsed.data.sideA);
  const sideB = normalizeText(parsed.data.sideB);
  const seen = new Set<string>();

  for (const term of selected) {
    const key = matchKey(term.termEng, term.termEsp);

    if (seen.has(key)) {
      return { ok: false, reason: "wrong_terms" };
    }

    seen.add(key);

    const source = direction === "en-es" ? term.termEng : term.termEsp;
    const target = direction === "en-es" ? term.termEsp : term.termEng;

    if (!sideA.includes(normalizeText(source))) {
      return { ok: false, reason: "missing_term" };
    }

    if (!sideB.includes(normalizeText(target))) {
      return { ok: false, reason: "missing_term" };
    }
  }

  return {
    ok: true,
    sideA: parsed.data.sideA,
    sideB: parsed.data.sideB,
    terms: [...selected],
  };
}
