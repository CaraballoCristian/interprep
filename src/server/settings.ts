import type { Language, Theme } from "@lib/types";
import { getSettings } from "@/db/bootstrap";
import { updateSettings } from "@/db/repositories/settings";

export type SettingsView = {
  theme: Theme;
  language: Language;
  lastTemplateId: string | null;
};

export type SettingsUpdate = {
  theme?: Theme;
  language?: Language;
};

function toView(row: {
  theme: Theme;
  language: Language;
  lastTemplateId: string | null;
}): SettingsView {
  return {
    theme: row.theme,
    language: row.language,
    lastTemplateId: row.lastTemplateId,
  };
}

export function readSettings(): SettingsView {
  return toView(getSettings());
}

/** Applies a partial preference update and returns the stored settings. */
export function writeSettings(input: SettingsUpdate): SettingsView {
  // Guarantees the row exists before the upsert.
  getSettings();
  return toView(updateSettings(input));
}
