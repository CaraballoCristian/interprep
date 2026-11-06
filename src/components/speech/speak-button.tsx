"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { SpeechLanguage } from "@lib/speech/voices";
import { useI18n } from "@/components/settings-provider";
import { useSpeech } from "./use-speech";

type SpeakButtonProps = {
  text: string;
  language?: SpeechLanguage;
  className?: string;
};

/**
 * Inline speaker button. It is hidden when the browser has no speech
 * synthesis, and stops propagation so it can live inside clickable cards.
 */
export function SpeakButton({
  text,
  language = "en",
  className = "",
}: SpeakButtonProps) {
  const { t } = useI18n();
  const { supported, speak } = useSpeech();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [text, language]);

  if (!supported) {
    return null;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setFailed(false);
    speak({
      text,
      language,
      onError: () => setFailed(true),
    });
  }

  const label = failed ? t("speech.error") : t("speech.play");

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base leading-none transition-colors ${
        failed
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-border bg-background text-muted hover:text-foreground"
      } ${className}`}
    >
      <span aria-hidden="true">{failed ? "⚠" : "🔊"}</span>
    </button>
  );
}
