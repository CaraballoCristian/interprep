export type SpeechLanguage = "en" | "es";

/** BCP-47 tag used for the utterance; the chosen voice may differ. */
export function speechLanguageTag(language: SpeechLanguage): string {
  return language === "en" ? "en-US" : "es-ES";
}

type VoiceLike = {
  lang: string;
  localService: boolean;
};

/**
 * Picks the best available voice for a language: local voices first because
 * they work offline and do not depend on a network service, then any voice
 * whose language matches.
 */
export function selectSpeechVoice<T extends VoiceLike>(
  voices: readonly T[],
  language: SpeechLanguage,
): T | null {
  const candidates = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(language),
  );

  return candidates.find((voice) => voice.localService) ?? candidates[0] ?? null;
}
