"use client";

import { useId } from "react";
import type { Language } from "@lib/types";
import { useSettings } from "./settings-provider";

/**
 * Accessible theme toggle and ES/EN selector. Both controls are at least
 * 48px tall and expose their state through `aria-pressed` / a native select.
 */
export function SettingsControls({ className = "" }: { className?: string }) {
  const { theme, language, setTheme, setLanguage, t, saveError } =
    useSettings();
  const languageId = useId();
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setTheme(nextTheme)}
        aria-label={nextTheme === "light" ? t("settings.toLight") : t("settings.toDark")}
        aria-pressed={theme === "light"}
        title={nextTheme === "light" ? t("settings.toLight") : t("settings.toDark")}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-lg"
      >
        <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      </button>

      <label htmlFor={languageId} className="sr-only">
        {t("settings.language")}
      </label>
      <select
        id={languageId}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
        aria-label={t("settings.language")}
        className="h-12 rounded-xl border border-border bg-surface px-2 text-sm font-semibold"
      >
        <option value="es">ES</option>
        <option value="en">EN</option>
      </select>

      {saveError && (
        <span role="alert" className="sr-only">
          {t("settings.saveError")}
        </span>
      )}
    </div>
  );
}
