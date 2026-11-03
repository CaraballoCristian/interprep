import { DECK_NAME_MAX_LENGTH } from "./types";

export type DeckNameValidation =
  | { ok: true; name: string }
  | { ok: false; error: "empty_name" | "name_too_long" };

/** Trims and collapses internal whitespace in a deck name. */
export function sanitizeDeckName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function validateDeckName(value: unknown): DeckNameValidation {
  const name = sanitizeDeckName(value);

  if (name === "") {
    return { ok: false, error: "empty_name" };
  }

  if (name.length > DECK_NAME_MAX_LENGTH) {
    return { ok: false, error: "name_too_long" };
  }

  return { ok: true, name };
}
