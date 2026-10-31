import type { CardStatus } from "../types";

const STATUS_ALIASES: Record<string, CardStatus> = {
  nueva: "new",
  nuevo: "new",
  new: "new",
  aprendiendo: "learning",
  learning: "learning",
  aprendida: "learned",
  aprendido: "learned",
  learned: "learned",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Maps a spreadsheet status to the internal enum.
 * Empty values default to `new`; unknown values return null (row error).
 */
export function normalizeStatus(raw: string): CardStatus | null {
  const normalized = normalize(raw);
  if (normalized === "") {
    return "new";
  }
  return STATUS_ALIASES[normalized] ?? null;
}
