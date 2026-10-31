import { CARD_STATUSES, type CardStatus } from "../types";

export type CardInput = {
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
};

export type CardInputError = "terms_required" | "invalid_status";

export type CardValidation =
  | { ok: true; card: CardInput }
  | { ok: false; error: CardInputError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Missing/null status defaults to `new`; an invalid status is rejected. */
function readStatus(value: unknown): CardStatus | null {
  if (value === undefined || value === null) {
    return "new";
  }
  if (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  ) {
    return value as CardStatus;
  }
  return null;
}

export function normalizeCardInput(value: unknown): CardInput {
  const input = isRecord(value) ? value : {};

  return {
    termEng: readString(input.termEng),
    termEsp: readString(input.termEsp),
    category: readString(input.category),
    description: readString(input.description),
    status: readStatus(input.status) ?? "new",
  };
}

export function validateCardInput(value: unknown): CardValidation {
  const input = isRecord(value) ? value : {};
  const status = readStatus(input.status);

  if (status === null) {
    return { ok: false, error: "invalid_status" };
  }

  const card: CardInput = {
    termEng: readString(input.termEng),
    termEsp: readString(input.termEsp),
    category: readString(input.category),
    description: readString(input.description),
    status,
  };

  if (card.termEng === "" || card.termEsp === "") {
    return { ok: false, error: "terms_required" };
  }

  return { ok: true, card };
}
