import type { DeckSummary } from "@lib/decks/types";
import { buildDeck } from "@lib/study/deck";
import type { StudyView } from "@lib/study/session";
import type { StudyConfig } from "@lib/study/types";
import {
  normalizeConfig,
  validateConfig,
  validateTemplateName,
} from "@lib/templates/validation";
import { countCards, listStudyCards } from "@/db/repositories/cards";
import {
  listCategoriesByDeck,
  listDeckSummaries,
} from "@/db/repositories/decks";
import { setLastTemplateId } from "@/db/repositories/settings";
import {
  createTemplate,
  deleteTemplate,
  findTemplateByName,
  getTemplateById,
  listTemplates,
  updateTemplate,
  type TemplateInput,
} from "@/db/repositories/templates";
import type { Template } from "@/db/schema";
import {
  categoriesForDecks,
  pruneConfigDecks,
} from "./decks";
import {
  applyStudyConfig,
  detachSessionTemplate,
  getStudyView,
} from "./study";

export type TemplateView = {
  id: string;
  name: string;
  config: StudyConfig;
  createdAt: string;
  updatedAt: string;
};

export type FiltersView = {
  config: StudyConfig;
  templateId: string | null;
  /** Categories available in the selected decks. */
  categories: string[];
  /** Categories present in each deck, used to recompute the union live. */
  categoriesByDeck: Record<string, string[]>;
  decks: DeckSummary[];
  templates: TemplateView[];
  cardCount: number;
  deckCount: number;
  /** True when the current session already has answers. */
  sessionActive: boolean;
};

export type TemplateErrorCode =
  | "invalid_config"
  | "invalid_name"
  | "duplicate_name"
  | "not_found"
  | "empty_update";

export class TemplateError extends Error {
  readonly code: TemplateErrorCode;

  constructor(code: TemplateErrorCode) {
    super(code);
    this.name = "TemplateError";
    this.code = code;
  }
}

function configFromTemplate(template: Template): StudyConfig {
  return normalizeConfig({
    sideA: template.sideA,
    sideB: template.sideB,
    categories: template.categories,
    deckIds: template.deckIds,
    statuses: template.statuses,
    continuous: template.continuous,
  });
}

function toTemplateView(
  userId: string,
  template: Template,
): TemplateView {
  return {
    id: template.id,
    name: template.name,
    config: pruneConfigDecks(userId, configFromTemplate(template)),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function requireConfig(
  userId: string,
  value: unknown,
): StudyConfig {
  const result = validateConfig(value);
  if (!result.ok) {
    throw new TemplateError("invalid_config");
  }
  return pruneConfigDecks(userId, result.config);
}

function requireName(value: unknown): string {
  const result = validateTemplateName(value);
  if (!result.ok) {
    throw new TemplateError("invalid_name");
  }
  return result.name;
}

export function listTemplateViews(userId: string): TemplateView[] {
  return listTemplates(userId).map((template) =>
    toTemplateView(userId, template),
  );
}

/** Everything the filters screen needs: current session config and options. */
export function getFiltersView(userId: string): FiltersView {
  const view = getStudyView(userId);
  const cards = listStudyCards(userId);
  const decks = listDeckSummaries(userId);
  const config = pruneConfigDecks(userId, view.config);
  const categoriesByDeck = listCategoriesByDeck(userId);
  const allDeckIds = decks.map((deck) => deck.id);

  return {
    config,
    templateId: view.templateId,
    categories: categoriesForDecks(
      config.deckIds,
      categoriesByDeck,
      allDeckIds,
    ),
    categoriesByDeck,
    decks,
    templates: listTemplateViews(userId),
    cardCount: countCards(userId),
    deckCount: buildDeck(cards, config).length,
    sessionActive: view.progress.answered > 0,
  };
}

/** Saves the given config under a new name. Does not apply it. */
export function saveTemplate(
  userId: string,
  input: {
    name: unknown;
    config: unknown;
  },
): TemplateView {
  const name = requireName(input.name);
  const config = requireConfig(userId, input.config);

  if (findTemplateByName(userId, name)) {
    throw new TemplateError("duplicate_name");
  }

  return toTemplateView(
    userId,
    createTemplate(userId, { name, ...config }),
  );
}

/**
 * Renames a template and/or overwrites its config. Saving never applies the
 * config to the running session.
 */
export function updateTemplateConfig(
  userId: string,
  id: string,
  input: { name?: unknown; config?: unknown },
): TemplateView {
  if (!getTemplateById(userId, id)) {
    throw new TemplateError("not_found");
  }

  const patch: Partial<TemplateInput> = {};

  if ("name" in input) {
    const name = requireName(input.name);
    if (findTemplateByName(userId, name, id)) {
      throw new TemplateError("duplicate_name");
    }
    patch.name = name;
  }

  if ("config" in input) {
    Object.assign(patch, requireConfig(userId, input.config));
  }

  if (Object.keys(patch).length === 0) {
    throw new TemplateError("empty_update");
  }

  const updated = updateTemplate(userId, id, patch);
  if (!updated) {
    throw new TemplateError("not_found");
  }

  return toTemplateView(userId, updated);
}

/** Deletes a template and detaches it from the session if it was applied. */
export function removeTemplate(userId: string, id: string): void {
  if (!getTemplateById(userId, id)) {
    throw new TemplateError("not_found");
  }

  deleteTemplate(userId, id);
  detachSessionTemplate(userId, id);
}

/**
 * Applies a template: replaces the session config, starts a new round and
 * remembers the template as the last one used.
 */
export function applyTemplateToSession(
  userId: string,
  id: string,
): StudyView {
  const template = getTemplateById(userId, id);
  if (!template) {
    throw new TemplateError("not_found");
  }

  const config = requireConfig(userId, {
    sideA: template.sideA,
    sideB: template.sideB,
    categories: template.categories,
    deckIds: template.deckIds,
    statuses: template.statuses,
    continuous: template.continuous,
  });

  const view = applyStudyConfig(userId, config, template.id);
  setLastTemplateId(userId, template.id);
  return view;
}
