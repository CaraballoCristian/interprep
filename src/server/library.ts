import { validateCardInput } from "@lib/library/card-input";
import {
  exportCardsCsv,
  exportCardsJson,
} from "@lib/library/export";
import {
  DEFAULT_LIBRARY_FILTER,
  filterCards,
  normalizeLibraryFilter,
  type HiddenFilter,
  type LibraryFilter,
} from "@lib/library/filter";
import type { LibraryCard } from "@lib/library/types";
import { matchKey } from "@lib/normalize";
import type { CardStatus } from "@lib/types";
import {
  createCard,
  deleteCard,
  findCardByMatchKey,
  getCardById,
  listCategories,
  listLibraryCards,
  updateCard,
  updateCardHidden,
  type LibraryCardInput,
} from "@/db/repositories/cards";

export type LibraryView = {
  filter: LibraryFilter;
  cards: LibraryCard[];
  categories: string[];
  total: number;
  visible: number;
  hidden: number;
  filtered: number;
};

export type ExportFormat = "csv" | "json";

export type ExportFile = {
  body: string;
  contentType: string;
  filename: string;
};

export type LibraryErrorCode =
  | "not_found"
  | "duplicate_card"
  | "terms_required"
  | "invalid_status"
  | "invalid_hidden"
  | "empty_update";

export class LibraryError extends Error {
  readonly code: LibraryErrorCode;

  constructor(code: LibraryErrorCode) {
    super(code);
    this.name = "LibraryError";
    this.code = code;
  }
}

/** Reads the filters from the query string, falling back to defaults. */
export function parseLibraryFilter(params: URLSearchParams): LibraryFilter {
  return normalizeLibraryFilter({
    search: params.get("search") ?? "",
    category: params.get("category"),
    status: (params.get("status") ?? undefined) as CardStatus | undefined,
    hidden: (params.get("hidden") ?? undefined) as HiddenFilter | undefined,
  });
}

export function getLibraryView(
  filter: LibraryFilter = DEFAULT_LIBRARY_FILTER,
): LibraryView {
  const all = listLibraryCards();
  const cards = filterCards(all, filter);

  return {
    filter,
    cards,
    categories: listCategories(),
    total: all.length,
    visible: all.filter((card) => !card.hidden).length,
    hidden: all.filter((card) => card.hidden).length,
    filtered: cards.length,
  };
}

function requireCardInput(value: unknown): LibraryCardInput {
  const result = validateCardInput(value);
  if (!result.ok) {
    throw new LibraryError(result.error);
  }
  return result.card;
}

function requireUniqueTerms(
  input: LibraryCardInput,
  excludeId?: string,
): void {
  const existing = findCardByMatchKey(
    matchKey(input.termEng, input.termEsp),
    excludeId,
  );

  if (existing) {
    throw new LibraryError("duplicate_card");
  }
}

/** Creates a visible card. History and counters start empty. */
export function createCardFromInput(input: unknown): LibraryCard {
  const card = requireCardInput(input);
  requireUniqueTerms(card);
  return createCard(card);
}

export type CardPatch = {
  termEng?: unknown;
  termEsp?: unknown;
  category?: unknown;
  description?: unknown;
  status?: unknown;
  hidden?: unknown;
};

/**
 * Applies a partial update. Content fields are merged over the stored card and
 * validated as a whole; `hidden` can be changed alone or together with them.
 */
export function updateCardFromInput(
  id: string,
  patch: CardPatch,
): LibraryCard {
  const existing = getCardById(id);
  if (!existing) {
    throw new LibraryError("not_found");
  }

  const contentKeys = [
    "termEng",
    "termEsp",
    "category",
    "description",
    "status",
  ] as const;
  const hasContent = contentKeys.some((key) => patch[key] !== undefined);
  const hasHidden = patch.hidden !== undefined;

  if (!hasContent && !hasHidden) {
    throw new LibraryError("empty_update");
  }

  if (hasContent) {
    const merged = requireCardInput({
      termEng: patch.termEng ?? existing.termEng,
      termEsp: patch.termEsp ?? existing.termEsp,
      category: patch.category ?? existing.category,
      description: patch.description ?? existing.description,
      status: patch.status ?? existing.status,
    });

    requireUniqueTerms(merged, id);
    updateCard(id, merged);
  }

  if (hasHidden) {
    if (typeof patch.hidden !== "boolean") {
      throw new LibraryError("invalid_hidden");
    }
    updateCardHidden(id, patch.hidden);
  }

  const updated = getCardById(id);
  if (!updated) {
    throw new LibraryError("not_found");
  }
  return updated;
}

/** Shows or hides a card. Hiding keeps it recoverable from the library. */
export function setCardVisibility(id: string, hidden: boolean): LibraryCard {
  if (!getCardById(id)) {
    throw new LibraryError("not_found");
  }

  updateCardHidden(id, hidden);

  const updated = getCardById(id);
  if (!updated) {
    throw new LibraryError("not_found");
  }
  return updated;
}

export function removeCard(id: string): void {
  if (!deleteCard(id)) {
    throw new LibraryError("not_found");
  }
}

/** Full backup of every card, including hidden ones and their history. */
export function buildExport(
  format: ExportFormat,
  now = new Date(),
): ExportFile {
  const cards = filterCards(listLibraryCards(), DEFAULT_LIBRARY_FILTER);
  const stamp = now.toISOString().slice(0, 10);

  if (format === "json") {
    return {
      body: exportCardsJson(cards, now.toISOString()),
      contentType: "application/json; charset=utf-8",
      filename: `interprep-cards-${stamp}.json`,
    };
  }

  return {
    body: exportCardsCsv(cards),
    contentType: "text/csv; charset=utf-8",
    filename: `interprep-cards-${stamp}.csv`,
  };
}
