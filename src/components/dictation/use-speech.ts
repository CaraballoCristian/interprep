"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DictationSpeed } from "@lib/dictation/types";

export const SPEECH_RATES: Record<DictationSpeed, number> = {
  slow: 0.7,
  normal: 1,
  fast: 1.3,
};

type SpeakOptions = {
  text: string;
  language: "en" | "es";
  speed: DictationSpeed;
  onEnd?: () => void;
  onError?: (reason: string) => void;
};

/**
 * Small wrapper over the browser SpeechSynthesis API. It cancels the previous
 * utterance, picks a voice for the requested language and reports completion
 * so the silence timer can start exactly when the audio ends.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const currentRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        currentRef.current = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    currentRef.current = null;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    ({ text, language, speed, onEnd, onError }: SpeakOptions) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        onError?.("unsupported");
        return;
      }

      const synth = window.speechSynthesis;
      currentRef.current = null;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const langCode = language === "en" ? "en" : "es";
      utterance.lang = language === "en" ? "en-US" : "es-ES";
      utterance.rate = SPEECH_RATES[speed];
      utterance.pitch = 1;

      const voices = synth.getVoices();
      const voice =
        voices.find(
          (candidate) =>
            candidate.lang.toLowerCase().startsWith(langCode) &&
            candidate.localService,
        ) ??
        voices.find((candidate) =>
          candidate.lang.toLowerCase().startsWith(langCode),
        );

      if (voice) {
        utterance.voice = voice;
      }

      currentRef.current = utterance;

      utterance.onend = () => {
        if (currentRef.current !== utterance) {
          return;
        }
        currentRef.current = null;
        onEnd?.();
      };

      utterance.onerror = (event) => {
        if (currentRef.current !== utterance) {
          return;
        }
        currentRef.current = null;
        if (event.error === "interrupted" || event.error === "canceled") {
          return;
        }
        onError?.(event.error);
      };

      synth.speak(utterance);
    },
    [],
  );

  return { supported, speak, cancel };
}
