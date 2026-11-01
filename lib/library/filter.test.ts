import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIBRARY_FILTER,
  filterCards,
  matchesLibraryFilter,
  normalizeLibraryFilter,
  type LibraryFilter,
} from "./filter";
import type { LibraryCard } from "./types";

function card(overrides: Partial<LibraryCard>): LibraryCard {
  return {
    id: overrides.id ?? "id",
    termEng: overrides.termEng ?? "",
    termEsp: overrides.termEsp ?? "",
    category: overrides.category ?? "",
    description: overrides.description ?? "",
    status: overrides.status ?? "new",
    hidden: overrides.hidden ?? false,
    history: overrides.history ?? [],
    totalSuccess: overrides.totalSuccess ?? 0,
    totalFail: overrides.totalFail ?? 0,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const cards: LibraryCard[] = [
  card({
    id: "policy",
    termEng: "Policy",
    termEsp: "Póliza",
    category: "Insurance",
    description: "Contract document",
    status: "new",
  }),
  card({
    id: "hearing",
    termEng: "Hearing",
    termEsp: "Audiencia",
    category: "Court",
    status: "hard",
    hidden: true,
  }),
  card({
    id: "claim",
    termEng: "Claim",
    termEsp: "Reclamo",
    category: "Insurance",
    status: "learned",
    totalSuccess: 3,
  }),
  card({
    id: "uncategorized",
    termEng: "Zebra",
    termEsp: "Cebra",
    category: "",
    status: "new",
  }),
];

function filter(overrides: Partial<LibraryFilter>): LibraryFilter {
  return { ...DEFAULT_LIBRARY_FILTER, ...overrides };
}

function ids(result: LibraryCard[]): string[] {
  return result.map((item) => item.id);
}

describe("normalizeLibraryFilter", () => {
  it("keeps a complete filter", () => {
    const input: LibraryFilter = {
      search: "  policy ",
      category: "Insurance",
      status: "hard",
      hidden: "hidden",
    };

    expect(normalizeLibraryFilter(input)).toEqual({
      search: "policy",
      category: "Insurance",
      status: "hard",
      hidden: "hidden",
    });
  });

  it("defaults missing fields", () => {
    expect(normalizeLibraryFilter({})).toEqual(DEFAULT_LIBRARY_FILTER);
  });

  it("drops an unknown status", () => {
    expect(
      normalizeLibraryFilter({ status: "bogus" as LibraryCard["status"] }),
    ).toEqual(DEFAULT_LIBRARY_FILTER);
  });

  it("falls back to all for an unknown hidden filter", () => {
    expect(
      normalizeLibraryFilter({ hidden: "bogus" as LibraryFilter["hidden"] }),
    ).toEqual(DEFAULT_LIBRARY_FILTER);
  });

  it("keeps the empty category because it is valid", () => {
    expect(normalizeLibraryFilter({ category: "" })).toEqual({
      ...DEFAULT_LIBRARY_FILTER,
      category: "",
    });
  });

  it("treats non-string values as missing", () => {
    expect(
      normalizeLibraryFilter({
        search: 7 as unknown as string,
        category: 7 as unknown as string,
      }),
    ).toEqual(DEFAULT_LIBRARY_FILTER);
  });
});

describe("filterCards", () => {
  it("returns all cards sorted alphabetically by English term", () => {
    expect(ids(filterCards(cards, DEFAULT_LIBRARY_FILTER))).toEqual([
      "claim",
      "hearing",
      "policy",
      "uncategorized",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [...cards];
    filterCards(input, DEFAULT_LIBRARY_FILTER);
    expect(input.map((item) => item.id)).toEqual([
      "policy",
      "hearing",
      "claim",
      "uncategorized",
    ]);
  });

  it("searches accent-insensitively across all text fields", () => {
    expect(ids(filterCards(cards, filter({ search: "poliza" })))).toEqual([
      "policy",
    ]);
    expect(ids(filterCards(cards, filter({ search: "PÓLIZA" })))).toEqual([
      "policy",
    ]);
    expect(ids(filterCards(cards, filter({ search: "document" })))).toEqual([
      "policy",
    ]);
    expect(ids(filterCards(cards, filter({ search: "insurance" })))).toEqual([
      "claim",
      "policy",
    ]);
  });

  it("matches partial words and collapses whitespace", () => {
    expect(ids(filterCards(cards, filter({ search: "  recla  " })))).toEqual([
      "claim",
    ]);
  });

  it("returns nothing when the search does not match", () => {
    expect(filterCards(cards, filter({ search: "banana" }))).toEqual([]);
  });

  it("filters by category, keeping the empty category valid", () => {
    expect(ids(filterCards(cards, filter({ category: "Insurance" })))).toEqual([
      "claim",
      "policy",
    ]);
    expect(ids(filterCards(cards, filter({ category: "" })))).toEqual([
      "uncategorized",
    ]);
    expect(filterCards(cards, filter({ category: "Missing" }))).toEqual([]);
  });

  it("filters by status", () => {
    expect(ids(filterCards(cards, filter({ status: "new" })))).toEqual([
      "policy",
      "uncategorized",
    ]);
    expect(ids(filterCards(cards, filter({ status: "hard" })))).toEqual([
      "hearing",
    ]);
    expect(ids(filterCards(cards, filter({ status: "learned" })))).toEqual([
      "claim",
    ]);
  });

  it("filters visible and hidden cards", () => {
    expect(
      ids(filterCards(cards, filter({ hidden: "visible" }))),
    ).toEqual(["claim", "policy", "uncategorized"]);
    expect(ids(filterCards(cards, filter({ hidden: "hidden" })))).toEqual([
      "hearing",
    ]);
  });

  it("combines search, category, status and hidden filters", () => {
    expect(
      ids(
        filterCards(
          cards,
          filter({
            search: "reclamo",
            category: "Insurance",
            status: "learned",
            hidden: "visible",
          }),
        ),
      ),
    ).toEqual(["claim"]);

    expect(
      filterCards(
        cards,
        filter({
          search: "reclamo",
          category: "Insurance",
          status: "new",
          hidden: "visible",
        }),
      ),
    ).toEqual([]);
  });

  it("breaks ties by Spanish term", () => {
    const tied = [
      card({ id: "b", termEng: "Same", termEsp: "Zeta" }),
      card({ id: "a", termEng: "Same", termEsp: "Alfa" }),
    ];

    expect(ids(filterCards(tied, DEFAULT_LIBRARY_FILTER))).toEqual(["a", "b"]);
  });
});

describe("matchesLibraryFilter", () => {
  it("matches an empty filter", () => {
    expect(matchesLibraryFilter(cards[0], DEFAULT_LIBRARY_FILTER)).toBe(true);
  });

  it("rejects a card outside the category", () => {
    expect(
      matchesLibraryFilter(cards[0], filter({ category: "Court" })),
    ).toBe(false);
  });
});
