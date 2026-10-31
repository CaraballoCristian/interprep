import type { LibraryCard } from "./types";

const CSV_COLUMNS = [
  "Id",
  "English",
  "Spanish",
  "Category",
  "Status",
  "Description",
  "Hidden",
  "History",
  "TotalSuccess",
  "TotalFail",
  "CreatedAt",
  "UpdatedAt",
] as const;

export const CSV_EXPORT_HEADER = CSV_COLUMNS.join(",");

/** Quotes a CSV cell only when it contains a comma, quote or line break. */
export function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Full backup: includes hidden cards, history and counters. */
export function exportCardsCsv(cards: readonly LibraryCard[]): string {
  const lines = [CSV_EXPORT_HEADER];

  for (const card of cards) {
    lines.push(
      [
        card.id,
        card.termEng,
        card.termEsp,
        card.category,
        card.status,
        card.description,
        String(card.hidden),
        JSON.stringify(card.history),
        String(card.totalSuccess),
        String(card.totalFail),
        card.createdAt,
        card.updatedAt,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function exportCardsJson(
  cards: readonly LibraryCard[],
  exportedAt = new Date().toISOString(),
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt,
      cards,
    },
    null,
    2,
  );
}
