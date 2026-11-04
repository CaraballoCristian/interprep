import { DICTATION_RESPONSE_SCHEMA } from "@lib/dictation/prompt";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;
/**
 * Small output cap: a phrase is 1-2 sentences plus a tiny JSON envelope.
 * Keeping it low is the cheapest guard against a runaway generation.
 */
const MAX_OUTPUT_TOKENS = 512;

export type GeminiErrorCode =
  | "invalid_api_key"
  | "rate_limited"
  | "generation_failed"
  | "gemini_timeout";

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;

  constructor(code: GeminiErrorCode) {
    super(code);
    this.name = "GeminiError";
    this.code = code;
  }
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

type GeminiPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

function mapResponseError(
  status: number,
  body: GeminiPayload | null,
): GeminiError {
  const message = body?.error?.message ?? "";
  const reason = body?.error?.status ?? "";
  const detail = `${reason} ${message}`;

  if (status === 429) {
    return new GeminiError("rate_limited");
  }

  if (status === 401 || status === 403) {
    return new GeminiError("invalid_api_key");
  }

  if (status === 400 && /api.?key|credential|permission/i.test(detail)) {
    return new GeminiError("invalid_api_key");
  }

  return new GeminiError("generation_failed");
}

async function readJson(
  response: Response,
): Promise<GeminiPayload | null> {
  try {
    return (await response.json()) as GeminiPayload;
  } catch {
    return null;
  }
}

function isAbort(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "name" in cause &&
    (cause as { name?: string }).name === "AbortError"
  );
}

/**
 * Calls Gemini with structured output and returns the parsed JSON. The key is
 * sent in the `x-goog-api-key` header, never in the URL, so it cannot leak
 * through access logs or error reports.
 */
export async function generateDictationJson(
  apiKey: string,
  prompt: string,
): Promise<unknown> {
  const model = getGeminiModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: "application/json",
            responseSchema: DICTATION_RESPONSE_SCHEMA,
            // Gemini 2.5 Flash spends tokens "thinking" by default. For a
            // short phrase this is pure cost, so it is disabled. Pro models
            // require a positive budget, so they keep their default.
            ...(model.startsWith("gemini-2.5-flash")
              ? { thinkingConfig: { thinkingBudget: 0 } }
              : {}),
          },
        }),
        signal: controller.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      throw mapResponseError(response.status, body);
    }

    if (body?.promptFeedback?.blockReason) {
      throw new GeminiError("generation_failed");
    }

    const text =
      body?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("") ?? "";

    if (text.trim().length === 0) {
      throw new GeminiError("generation_failed");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiError("generation_failed");
    }
  } catch (cause) {
    if (cause instanceof GeminiError) {
      throw cause;
    }
    if (isAbort(cause)) {
      throw new GeminiError("gemini_timeout");
    }
    throw new GeminiError("generation_failed");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validates a key with a metadata request (`models.get`), which does not
 * consume generation tokens. Used by the "Test connection" button.
 */
export async function validateGeminiKey(apiKey: string): Promise<void> {
  const model = getGeminiModel();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${API_BASE}/models/${encodeURIComponent(model)}`,
      {
        headers: { "x-goog-api-key": apiKey },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await readJson(response);
      throw mapResponseError(response.status, body);
    }
  } catch (cause) {
    if (cause instanceof GeminiError) {
      throw cause;
    }
    if (isAbort(cause)) {
      throw new GeminiError("gemini_timeout");
    }
    throw new GeminiError("generation_failed");
  } finally {
    clearTimeout(timeout);
  }
}
