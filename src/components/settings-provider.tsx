"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  translate,
  type TranslationKey,
  type TranslationParams,
} from "@lib/i18n/dictionary";
import type { Language, Theme } from "@lib/types";

type SettingsContextValue = {
  theme: Theme;
  language: Language;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  saveError: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

type SettingsProviderProps = {
  initialTheme: Theme;
  initialLanguage: Language;
  children: React.ReactNode;
};

/**
 * Holds the user preferences on the client. The server layout renders the
 * initial `lang`/`data-theme` so the first paint is already correct; changes
 * are applied optimistically and persisted through `PUT /api/settings`.
 */
export function SettingsProvider({
  initialTheme,
  initialLanguage,
  children,
}: SettingsProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const persist = useCallback(
    async (patch: { theme?: Theme; language?: Language }) => {
      try {
        const response = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        setSaveError(!response.ok);
      } catch {
        setSaveError(true);
      }
    },
    [],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      void persist({ theme: next });
    },
    [persist],
  );

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      void persist({ language: next });
    },
    [persist],
  );

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language],
  );

  const value = useMemo(
    () => ({
      theme,
      language,
      setTheme,
      setLanguage,
      t,
      saveError,
    }),
    [theme, language, setTheme, setLanguage, t, saveError],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return context;
}

/** Convenience hook for components that only need the current language. */
export function useI18n(): Pick<SettingsContextValue, "language" | "t"> {
  const { language, t } = useSettings();
  return { language, t };
}
