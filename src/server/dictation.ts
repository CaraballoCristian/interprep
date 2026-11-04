import {
  buildDictationPrompt,
} from "@lib/dictation/prompt";
import {
  normalizeDictationConfig,
  resolveDirection,
} from "@lib/dictation/config";
import { selectDictationTerms } from "@lib/dictation/terms";
import type {
  DictationConfig,
  DictationGenerateResponse,
  DictationMeta,
} from "@lib/dictation/types";
import { validateDictationPhrase } from "@lib/dictation/validate";
import {
  listDictationCards,
  listDictationCategories,
} from "@/db/repositories/cards";
import {
  clearGeminiCredentials,
  readDictationConfig,
  readGeminiCredentials,
  writeDictationConfig,
  writeGeminiCredentials,
} from "@/db/repositories/settings";
import { decryptSecret, encryptSecret, secretHint } from "./crypto";
import {
  GeminiError,
  generateDictationJson,
  getGeminiModel,
  validateGeminiKey,
} from "./gemini";
import { checkRateLimit } from "./rate-limit";

export type DictationErrorCode =
  | "gemini_not_configured"
  | "gemini_key_unreadable"
  | "invalid_api_key"
  | "rate_limited"
  | "no_eligible_terms"
  | "not_enough_terms"
  | "generation_failed"
  | "gemini_timeout";

export class DictationError extends Error {
  readonly code: DictationErrorCode;

  constructor(code: DictationErrorCode) {
    super(code);
    this.name = "DictationError";
    this.code = code;
  }
}

function toDictationError(cause: unknown): DictationError {
  if (cause instanceof DictationError) {
    return cause;
  }
  if (cause instanceof GeminiError) {
    return new DictationError(cause.code);
  }
  return new DictationError("generation_failed");
}

function categoryNames(userId: string): string[] {
  return listDictationCategories(userId).map((category) => category.name);
}

/** Everything the Dictado panel needs, without ever returning the key. */
export function readDictationMeta(userId: string): DictationMeta {
  const categories = listDictationCategories(userId);
  const config = normalizeDictationConfig(
    readDictationConfig(userId),
    categories.map((category) => category.name),
  );
  const credentials = readGeminiCredentials(userId);

  return {
    config,
    categories,
    hasApiKey: Boolean(credentials.encrypted),
    keyHint: credentials.hint,
    model: getGeminiModel(),
  };
}

export function saveDictationConfig(
  userId: string,
  input: DictationConfig,
): DictationConfig {
  const config = normalizeDictationConfig(input, categoryNames(userId));
  writeDictationConfig(userId, config);
  return config;
}

export function saveGeminiKey(
  userId: string,
  apiKey: string,
): { hint: string } {
  const trimmed = apiKey.trim();

  if (trimmed.length < 10) {
    throw new DictationError("invalid_api_key");
  }

  const hint = secretHint(trimmed);
  writeGeminiCredentials(userId, encryptSecret(trimmed), hint);
  return { hint };
}

export function removeGeminiKey(userId: string): void {
  clearGeminiCredentials(userId);
}

function requireGeminiKey(userId: string): string {
  const credentials = readGeminiCredentials(userId);

  if (!credentials.encrypted) {
    throw new DictationError("gemini_not_configured");
  }

  const key = decryptSecret(credentials.encrypted);

  if (!key) {
    throw new DictationError("gemini_key_unreadable");
  }

  return key;
}

export async function testGeminiKey(userId: string): Promise<void> {
  const key = requireGeminiKey(userId);

  try {
    await validateGeminiKey(key);
  } catch (cause) {
    throw toDictationError(cause);
  }
}

/**
 * Generates one phrase. There is intentionally no automatic retry: a failed
 * validation is surfaced as a retryable error so the user decides whether to
 * spend another request.
 */
export async function generateDictation(
  userId: string,
  input: DictationConfig,
): Promise<DictationGenerateResponse> {
  const cards = listDictationCards(userId);
  const available = [...new Set(cards.map((card) => card.category))];
  const config = normalizeDictationConfig(input, available);
  const selection = selectDictationTerms(cards, config);

  if (!selection.ok) {
    throw new DictationError(selection.code);
  }

  const key = requireGeminiKey(userId);
  const limit = checkRateLimit(`dictation:${userId}`);

  if (!limit.ok) {
    throw new DictationError("rate_limited");
  }

  const direction = resolveDirection(config.direction);
  const prompt = buildDictationPrompt({
    direction,
    length: config.length,
    scenarioCategory: selection.scenarioCategory,
    terms: selection.terms,
  });

  let raw: unknown;

  try {
    raw = await generateDictationJson(key, prompt);
  } catch (cause) {
    throw toDictationError(cause);
  }

  const validated = validateDictationPhrase(
    raw,
    selection.terms,
    direction,
  );

  if (!validated.ok) {
    throw new DictationError("generation_failed");
  }

  return {
    phrase: {
      id: crypto.randomUUID(),
      sideA: validated.sideA,
      sideB: validated.sideB,
      direction,
      scenarioCategory: selection.scenarioCategory,
      terms: validated.terms,
      createdAt: new Date().toISOString(),
    },
    warnings: selection.warnings,
  };
}
