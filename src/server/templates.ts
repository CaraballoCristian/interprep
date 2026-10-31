import { buildDeck } from "@lib/study/deck";
import type { StudyView } from "@lib/study/session";
import type { StudyConfig } from "@lib/study/types";
import {
  normalizeConfig,
  validateConfig,
  validateTemplateName,
} from "@lib/templates/validation";
import {
  countCards,
  listCategories,
  listStudyCards,
} from "@/db/repositories/cards";
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
  categories: string[];
  templates: TemplateView[];
  cardCount: number;
  deckCount: number;
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
    statuses: template.statuses,
  });
}

function toTemplateView(template: Template): TemplateView {
  return {
    id: template.id,
    name: template.name,
    config: configFromTemplate(template),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

function requireConfig(value: unknown): StudyConfig {
  const result = validateConfig(value);
  if (!result.ok) {
    throw new TemplateError("invalid_config");
  }
  return result.config;
}

function requireName(value: unknown): string {
  const result = validateTemplateName(value);
  if (!result.ok) {
    throw new TemplateError("invalid_name");
  }
  return result.name;
}

export function listTemplateViews(): TemplateView[] {
  return listTemplates().map(toTemplateView);
}

/** Everything the filters screen needs: current session config and options. */
export function getFiltersView(): FiltersView {
  const view = getStudyView();
  const cards = listStudyCards();

  return {
    config: view.config,
    templateId: view.templateId,
    categories: listCategories(),
    templates: listTemplateViews(),
    cardCount: countCards(),
    deckCount: buildDeck(cards, view.config).length,
  };
}

/** Saves the given config under a new name. Does not apply it. */
export function saveTemplate(input: {
  name: unknown;
  config: unknown;
}): TemplateView {
  const name = requireName(input.name);
  const config = requireConfig(input.config);

  if (findTemplateByName(name)) {
    throw new TemplateError("duplicate_name");
  }

  return toTemplateView(createTemplate({ name, ...config }));
}

/**
 * Renames a template and/or overwrites its config. Saving never applies the
 * config to the running session.
 */
export function updateTemplateConfig(
  id: string,
  input: { name?: unknown; config?: unknown },
): TemplateView {
  if (!getTemplateById(id)) {
    throw new TemplateError("not_found");
  }

  const patch: Partial<TemplateInput> = {};

  if ("name" in input) {
    const name = requireName(input.name);
    if (findTemplateByName(name, id)) {
      throw new TemplateError("duplicate_name");
    }
    patch.name = name;
  }

  if ("config" in input) {
    Object.assign(patch, requireConfig(input.config));
  }

  if (Object.keys(patch).length === 0) {
    throw new TemplateError("empty_update");
  }

  const updated = updateTemplate(id, patch);
  if (!updated) {
    throw new TemplateError("not_found");
  }

  return toTemplateView(updated);
}

/** Deletes a template and detaches it from the session if it was applied. */
export function removeTemplate(id: string): void {
  if (!getTemplateById(id)) {
    throw new TemplateError("not_found");
  }

  deleteTemplate(id);
  detachSessionTemplate(id);
}

/**
 * Applies a template: replaces the session config, starts a new round and
 * remembers the template as the last one used.
 */
export function applyTemplateToSession(id: string): StudyView {
  const template = getTemplateById(id);
  if (!template) {
    throw new TemplateError("not_found");
  }

  const config = requireConfig({
    sideA: template.sideA,
    sideB: template.sideB,
    categories: template.categories,
    statuses: template.statuses,
  });

  const view = applyStudyConfig(config, template.id);
  setLastTemplateId(template.id);
  return view;
}
