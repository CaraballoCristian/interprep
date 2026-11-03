import type { LibraryCard } from "./types";

const CSV_COLUMNS = [
  "Id",
  "Deck",
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

function deckNameOf(
  deckNames: ReadonlyMap<string, string> | undefined,
  deckId: string,
): string {
  return deckNames?.get(deckId) ?? "";
}

/** Full backup: includes hidden cards, history and counters. */
export function exportCardsCsv(
  cards: readonly LibraryCard[],
  deckNames?: ReadonlyMap<string, string>,
): string {
  const lines = [CSV_EXPORT_HEADER];

  for (const card of cards) {
    lines.push(
      [
        card.id,
        deckNameOf(deckNames, card.deckId),
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
  deckNames?: ReadonlyMap<string, string>,
): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt,
      cards: cards.map((card) => ({
        ...card,
        deckName: deckNameOf(deckNames, card.deckId),
      })),
    },
    null,
    2,
  );
}
