import { describe, expect, it } from "vitest";
import {
  CSV_EXPORT_HEADER,
  escapeCsv,
  exportCardsCsv,
  exportCardsJson,
} from "./export";
import type { LibraryCard } from "./types";

const card: LibraryCard = {
  id: "card-1",
  deckId: "deck-general",
  termEng: "Policy",
  termEsp: "Póliza",
  category: "Insurance",
  description: "Contract, document",
  status: "hard",
  hidden: true,
  history: ["s", "f", "s"],
  totalSuccess: 2,
  totalFail: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("escapeCsv", () => {
  it("leaves plain values untouched", () => {
    expect(escapeCsv("Policy")).toBe("Policy");
    expect(escapeCsv("")).toBe("");
  });

  it("quotes values with commas", () => {
    expect(escapeCsv("Contract, document")).toBe('"Contract, document"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsv('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes values with line breaks", () => {
    expect(escapeCsv("line 1\nline 2")).toBe('"line 1\nline 2"');
    expect(escapeCsv("line 1\r\nline 2")).toBe('"line 1\r\nline 2"');
  });
});

describe("exportCardsCsv", () => {
  it("writes a header even with no cards", () => {
    expect(exportCardsCsv([])).toBe(`${CSV_EXPORT_HEADER}\r\n`);
  });

  it("exports every field, including hidden, history and counters", () => {
    const csv = exportCardsCsv([card]);
    const [header, row] = csv.trimEnd().split("\r\n");

    expect(header).toBe(CSV_EXPORT_HEADER);
    expect(row).toBe(
      [
        "card-1",
        "",
        "Policy",
        "Póliza",
        "Insurance",
        "hard",
        '"Contract, document"',
        "true",
        '"[""s"",""f"",""s""]"',
        "2",
        "1",
        "2026-01-01T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      ].join(","),
    );
  });

  it("exports the deck name when a map is provided", () => {
    const csv = exportCardsCsv(
      [card],
      new Map([["deck-general", "General"]]),
    );
    const [, row] = csv.trimEnd().split("\r\n");

    expect(row.split(",")[1]).toBe("General");
  });

  it("keeps a trailing newline and CRLF rows", () => {
    const csv = exportCardsCsv([card, { ...card, id: "card-2" }]);

    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4);
  });

  it("does not include a BOM in the pure helper", () => {
    expect(exportCardsCsv([card]).charCodeAt(0)).not.toBe(0xfeff);
  });
});

describe("exportCardsJson", () => {
  it("wraps cards with version and exportedAt", () => {
    const exportedAt = "2026-10-31T12:00:00.000Z";
    const parsed = JSON.parse(
      exportCardsJson([card], exportedAt),
    ) as unknown as {
      version: number;
      exportedAt: string;
      cards: LibraryCard[];
    };

    expect(parsed).toEqual({
      version: 1,
      exportedAt,
      cards: [{ ...card, deckName: "" }],
    });
  });

  it("adds the deck name to each exported card", () => {
    const parsed = JSON.parse(
      exportCardsJson(
        [card],
        "2026-10-31T12:00:00.000Z",
        new Map([["deck-general", "General"]]),
      ),
    ) as unknown as { cards: Array<LibraryCard & { deckName: string }> };

    expect(parsed.cards[0].deckName).toBe("General");
  });

  it("exports an empty list", () => {
    const parsed = JSON.parse(
      exportCardsJson([], "2026-10-31T12:00:00.000Z"),
    ) as unknown as { cards: LibraryCard[] };

    expect(parsed.cards).toEqual([]);
  });

  it("uses an ISO timestamp by default", () => {
    const parsed = JSON.parse(exportCardsJson([])) as unknown as {
      exportedAt: string;
    };

    expect(Number.isNaN(Date.parse(parsed.exportedAt))).toBe(false);
  });
});
