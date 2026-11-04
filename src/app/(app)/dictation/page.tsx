"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  languageForSide,
  mergeDictationConfig,
} from "@lib/dictation/config";
import {
  createDictationHistory,
  currentDictationEntry,
  dictationUndoCount,
  pushDictationEntry,
  undoDictationHistory,
  type DictationHistory,
} from "@lib/dictation/history";
import {
  armSilenceTimer,
  createSilenceTimer,
  resetSilenceTimer,
  startSilenceTimer,
  stopSilenceTimer,
  tickSilenceTimer,
  type SilenceTimerState,
} from "@lib/dictation/timer";
import type {
  DictationConfig,
  DictationGenerateResponse,
  DictationMeta,
  DictationPhrase,
  DictationSpeed,
} from "@lib/dictation/types";
import { PageHeading } from "@/components/page-heading";
import { useI18n } from "@/components/settings-provider";
import { DictationConfigPanel } from "@/components/dictation/dictation-config";
import { DictationSession } from "@/components/dictation/dictation-session";
import { useSpeech } from "@/components/dictation/use-speech";

function playAlertBeep(context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.32);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}

function errorCode(data: unknown): string | undefined {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error?: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return undefined;
}

export default function DictationPage() {
  const { t } = useI18n();
  const { supported, speak, cancel } = useSpeech();

  const [meta, setMeta] = useState<DictationMeta | null>(null);
  const [config, setConfig] = useState<DictationConfig | null>(null);
  const [history, setHistory] = useState<DictationHistory>(
    createDictationHistory,
  );
  const [revealed, setRevealed] = useState(false);
  const [timer, setTimer] = useState<SilenceTimerState>(
    createSilenceTimer(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const configRef = useRef<DictationConfig | null>(null);
  const historyRef = useRef<DictationHistory>(createDictationHistory());
  const busyRef = useRef(false);
  const revealedRef = useRef(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const alertedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const entry = currentDictationEntry(history);
  const undoCount = dictationUndoCount(history);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ??
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const readError = useCallback(
    (data: unknown): string => {
      switch (errorCode(data)) {
        case "gemini_not_configured":
          return t("dictation.geminiNotConfigured");
        case "gemini_key_unreadable":
          return t("dictation.geminiKeyUnreadable");
        case "invalid_api_key":
          return t("dictation.geminiKeyInvalid");
        case "rate_limited":
          return t("dictation.error.rateLimited");
        case "no_eligible_terms":
          return t("dictation.error.noEligible");
        case "not_enough_terms":
          return t("dictation.error.notEnough");
        case "generation_failed":
          return t("dictation.error.generation");
        case "gemini_timeout":
          return t("dictation.error.timeout");
        case "invalid_input":
          return t("dictation.error.invalidInput");
        default:
          return t("dictation.error.generic");
      }
    },
    [t],
  );

  const loadMeta = useCallback(async () => {
    setLoadError(null);

    try {
      const response = await fetch("/api/dictation", {
        cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      const next = data as DictationMeta;
      setMeta(next);
      setConfig(next.config);
      configRef.current = next.config;
      setTimer(createSilenceTimer(next.config.silenceSeconds));
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : t("dictation.loadError"),
      );
    }
  }, [readError, t]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      void audioContextRef.current?.close();
    };
  }, []);

  // Countdown: the timer only advances while it is running.
  useEffect(() => {
    if (timer.status !== "running") {
      return;
    }

    const interval = window.setInterval(() => {
      setTimer((current) => tickSilenceTimer(current, 250));
    }, 250);

    return () => window.clearInterval(interval);
  }, [timer.status]);

  // One alert per countdown: visual banner plus a short beep.
  useEffect(() => {
    if (timer.status !== "alerted") {
      alertedRef.current = false;
      return;
    }

    if (alertedRef.current) {
      return;
    }

    alertedRef.current = true;

    const context = ensureAudioContext();
    if (context) {
      playAlertBeep(context);
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(200);
    }
  }, [ensureAudioContext, timer.status]);

  function scheduleSave(next: DictationConfig) {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    setSaving(true);
    setSaveError(false);

    saveTimeoutRef.current = window.setTimeout(async () => {
      saveTimeoutRef.current = null;

      try {
        const response = await fetch("/api/dictation", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });

        if (!response.ok) {
          throw new Error("save_failed");
        }
      } catch {
        setSaveError(true);
      } finally {
        setSaving(false);
      }
    }, 600);
  }

  function updateConfig(patch: Partial<DictationConfig>) {
    const current = configRef.current;

    if (!current) {
      return;
    }

    const next = mergeDictationConfig(
      current,
      patch,
      meta?.categories.map((category) => category.name),
    );

    configRef.current = next;
    setConfig(next);
    scheduleSave(next);

    if ("silenceSeconds" in patch || "listenMode" in patch) {
      setTimer((value) =>
        resetSilenceTimer(value, next.silenceSeconds),
      );
    }
  }

  function playPhrase(
    phrase: DictationPhrase,
    current: DictationConfig,
    resetTimer: boolean,
  ) {
    if (resetTimer) {
      setTimer((value) =>
        armSilenceTimer(
          resetSilenceTimer(value, current.silenceSeconds),
        ),
      );
    }

    setAudioError(false);

    speak({
      text: phrase.sideA,
      language: languageForSide(phrase.direction, "A"),
      speed: current.speed,
      onEnd: () => {
        if (!configRef.current?.listenMode) {
          return;
        }
        if (revealedRef.current) {
          return;
        }
        setTimer((value) => startSilenceTimer(value));
      },
      onError: () => {
        setAudioError(true);
      },
    });
  }

  async function generateNext() {
    const current = configRef.current;

    if (!current || busyRef.current) {
      return;
    }

    ensureAudioContext();
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setAudioError(false);
    cancel();
    setTimer((value) => stopSilenceTimer(value));

    try {
      const response = await fetch("/api/dictation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: current }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(readError(data));
      }

      const result = data as DictationGenerateResponse;
      const nextHistory = pushDictationEntry(historyRef.current, {
        phrase: result.phrase,
        warnings: result.warnings,
      });

      historyRef.current = nextHistory;
      setHistory(nextHistory);
      revealedRef.current = false;
      setRevealed(false);
      setTimer((value) =>
        armSilenceTimer(
          resetSilenceTimer(value, current.silenceSeconds),
        ),
      );

      if (current.autoplay) {
        playPhrase(result.phrase, current, false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("dictation.error.generic"),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function playCurrent() {
    const current = configRef.current;
    const currentEntry = currentDictationEntry(historyRef.current);

    if (!current || !currentEntry) {
      return;
    }

    ensureAudioContext();
    playPhrase(currentEntry.phrase, current, true);
  }

  function reveal() {
    if (!currentDictationEntry(historyRef.current)) {
      return;
    }

    revealedRef.current = true;
    setRevealed(true);
    setTimer((value) => stopSilenceTimer(value));
  }

  function undo() {
    if (busyRef.current) {
      return;
    }

    const next = undoDictationHistory(historyRef.current);

    if (next.index === historyRef.current.index) {
      return;
    }

    historyRef.current = next;
    setHistory(next);
    revealedRef.current = false;
    setRevealed(false);
    setError(null);
    setAudioError(false);
    cancel();

    const current = configRef.current;
    setTimer((value) =>
      armSilenceTimer(
        resetSilenceTimer(value, current?.silenceSeconds ?? 5),
      ),
    );

    const currentEntry = currentDictationEntry(next);

    if (current && currentEntry && current.autoplay) {
      playPhrase(currentEntry.phrase, current, false);
    }
  }

  function changeSpeed(speed: DictationSpeed) {
    updateConfig({ speed });

    const current = configRef.current;
    const currentEntry = currentDictationEntry(historyRef.current);

    if (current && currentEntry) {
      ensureAudioContext();
      playPhrase(currentEntry.phrase, current, true);
    }
  }

  async function saveKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch("/api/dictation/key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        return false;
      }

      const result = data as {
        hasApiKey: boolean;
        keyHint: string | null;
      };

      setMeta((value) =>
        value
          ? {
              ...value,
              hasApiKey: result.hasApiKey,
              keyHint: result.keyHint,
            }
          : value,
      );

      return true;
    } catch {
      return false;
    }
  }

  async function clearKey(): Promise<boolean> {
    try {
      const response = await fetch("/api/dictation/key", {
        method: "DELETE",
      });

      if (!response.ok) {
        return false;
      }

      setMeta((value) =>
        value ? { ...value, hasApiKey: false, keyHint: null } : value,
      );

      return true;
    } catch {
      return false;
    }
  }

  async function testKey(): Promise<"ok" | "error"> {
    try {
      const response = await fetch("/api/dictation/key/test", {
        method: "POST",
      });

      return response.ok ? "ok" : "error";
    } catch {
      return "error";
    }
  }

  const actionsRef = useRef<{
    start: () => void;
    undo: () => void;
    reveal: () => void;
    speed: (speed: DictationSpeed) => void;
    hasPhrase: () => boolean;
    busy: () => boolean;
  }>({
    start: () => {},
    undo: () => {},
    reveal: () => {},
    speed: (_speed: DictationSpeed) => {},
    hasPhrase: () => false,
    busy: () => false,
  });

  actionsRef.current = {
    start: () => {
      void generateNext();
    },
    undo,
    reveal,
    speed: changeSpeed,
    hasPhrase: () =>
      currentDictationEntry(historyRef.current) !== null,
    busy: () => busyRef.current,
  };

  // Dictado shortcuts are scoped to this page. Text inputs keep their keys.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;

      if (target instanceof HTMLElement) {
        const tag = target.tagName;

        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }

        if (
          (event.key === " " || event.key === "Enter") &&
          (tag === "BUTTON" || tag === "A")
        ) {
          return;
        }
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const actions = actionsRef.current;

      if (actions.busy()) {
        return;
      }

      if (!actions.hasPhrase()) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          actions.start();
        }
        return;
      }

      switch (event.key) {
        case "Enter":
        case " ":
          event.preventDefault();
          actions.reveal();
          break;
        case "ArrowLeft":
          event.preventDefault();
          actions.speed("slow");
          break;
        case "ArrowDown":
          event.preventDefault();
          actions.speed("normal");
          break;
        case "ArrowRight":
          event.preventDefault();
          actions.speed("fast");
          break;
        case "ArrowUp":
          event.preventDefault();
          actions.start();
          break;
        case "z":
        case "Z":
        case "Backspace":
          event.preventDefault();
          actions.undo();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!meta || !config) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4">
        <PageHeading title={t("dictation.title")} />
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          {loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadMeta()}
                className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold"
              >
                {t("dictation.retry")}
              </button>
            </div>
          ) : (
            t("dictation.loading")
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-6 pt-4">
      <PageHeading
        title={t("dictation.title")}
        subtitle={t("dictation.subtitle")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-4">
          {!meta.hasApiKey && (
            <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
              {t("dictation.geminiNotConfigured")}
            </p>
          )}

          {entry ? (
            <DictationSession
              entry={entry}
              revealed={revealed}
              listenMode={config.listenMode}
              timer={timer}
              speed={config.speed}
              busy={busy}
              error={error}
              undoCount={undoCount}
              audioSupported={supported}
              audioError={audioError}
              onReveal={reveal}
              onNext={() => void generateNext()}
              onUndo={undo}
              onPlay={playCurrent}
              onSpeed={changeSpeed}
              onRetry={() => void generateNext()}
            />
          ) : (
            <section className="space-y-4 rounded-2xl border border-border bg-surface p-6 text-center">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("dictation.noPhraseTitle")}
                </h2>
                <p className="text-sm text-muted">
                  {t("dictation.noPhraseDescription")}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void generateNext()}
                disabled={busy}
                className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
              >
                {busy ? t("dictation.generating") : t("dictation.start")}
              </button>

              {error && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-left text-sm"
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => void generateNext()}
                    disabled={busy}
                    className="min-h-10 rounded-lg border border-danger/40 px-3 text-xs font-semibold text-danger disabled:opacity-50"
                  >
                    {t("dictation.retry")}
                  </button>
                </div>
              )}

              <p className="text-xs text-muted">
                {t("dictation.startHint")}
              </p>
            </section>
          )}
        </div>

        <aside>
          <DictationConfigPanel
            config={config}
            categories={meta.categories}
            hasApiKey={meta.hasApiKey}
            keyHint={meta.keyHint}
            model={meta.model}
            saving={saving}
            saveError={saveError}
            onChange={updateConfig}
            onSaveKey={saveKey}
            onClearKey={clearKey}
            onTestKey={testKey}
          />
        </aside>
      </div>
    </main>
  );
}
