"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  selectSpeechVoice,
  speechLanguageTag,
  type SpeechLanguage,
} from "@lib/speech/voices";

export type SpeechSpeed = "slow" | "normal" | "fast";

export const SPEECH_RATES: Record<SpeechSpeed, number> = {
  slow: 0.7,
  normal: 1,
  fast: 1.3,
};

type SpeakOptions = {
  text: string;
  language: SpeechLanguage;
  speed?: SpeechSpeed;
  onEnd?: () => void;
  onError?: (reason: string) => void;
};

function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/**
 * Small wrapper over the browser SpeechSynthesis API. It cancels the previous
 * utterance, picks a voice for the requested language and reports completion
 * so callers can react when the audio ends.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const currentRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(speechSupported());

    return () => {
      if (currentRef.current && speechSupported()) {
        currentRef.current = null;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (!speechSupported()) {
      return;
    }
    currentRef.current = null;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    ({
      text,
      language,
      speed = "normal",
      onEnd,
      onError,
    }: SpeakOptions) => {
      if (!speechSupported()) {
        onError?.("unsupported");
        return;
      }

      const synth = window.speechSynthesis;
      currentRef.current = null;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLanguageTag(language);
      utterance.rate = SPEECH_RATES[speed];
      utterance.pitch = 1;

      const voice = selectSpeechVoice(synth.getVoices(), language);

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
