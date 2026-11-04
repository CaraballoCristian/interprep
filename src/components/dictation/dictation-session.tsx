"use client";

import {
  languageForSide,
} from "@lib/dictation/config";
import {
  silenceSecondsLeft,
  type SilenceTimerState,
} from "@lib/dictation/timer";
import type {
  DictationDirection,
  DictationEntry,
  DictationSpeed,
  DictationWarning,
} from "@lib/dictation/types";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { useI18n } from "@/components/settings-provider";

const DIRECTION_KEYS: Record<DictationDirection, TranslationKey> = {
  "en-es": "dictation.direction.en-es",
  "es-en": "dictation.direction.es-en",
};

const SPEED_KEYS: Record<DictationSpeed, TranslationKey> = {
  slow: "dictation.speed.slow",
  normal: "dictation.speed.normal",
  fast: "dictation.speed.fast",
};

const LANGUAGE_KEYS = {
  en: "dictation.language.en",
  es: "dictation.language.es",
} as const;

type DictationSessionProps = {
  entry: DictationEntry;
  revealed: boolean;
  listenMode: boolean;
  timer: SilenceTimerState;
  speed: DictationSpeed;
  busy: boolean;
  error: string | null;
  undoCount: number;
  audioSupported: boolean;
  audioError: boolean;
  onReveal: () => void;
  onNext: () => void;
  onUndo: () => void;
  onPlay: () => void;
  onSpeed: (speed: DictationSpeed) => void;
  onRetry: () => void;
};

function warningText(
  warning: DictationWarning,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (warning.code === "general_empty") {
    return t("dictation.warning.generalEmpty");
  }
  return t("dictation.warning.categoryEmpty", {
    category: warning.category,
  });
}

export function DictationSession({
  entry,
  revealed,
  listenMode,
  timer,
  speed,
  busy,
  error,
  undoCount,
  audioSupported,
  audioError,
  onReveal,
  onNext,
  onUndo,
  onPlay,
  onSpeed,
  onRetry,
}: DictationSessionProps) {
  const { t } = useI18n();
  const { phrase } = entry;
  const sideALanguage = languageForSide(phrase.direction, "A");
  const sideBLanguage = languageForSide(phrase.direction, "B");
  const sideAHidden = listenMode && !revealed;
  const timerProgress =
    timer.durationMs === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            ((timer.durationMs - timer.remainingMs) / timer.durationMs) * 100,
          ),
        );

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            {t("dictation.scenario", { category: phrase.scenarioCategory })}
          </span>
          <span className="text-xs text-muted">
            {t(DIRECTION_KEYS[phrase.direction])}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("dictation.sideA")} · {t(LANGUAGE_KEYS[sideALanguage])}
          </p>
          {sideAHidden ? (
            <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center">
              <p className="text-sm text-muted">
                {t("dictation.listenPlaceholder")}
              </p>
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-xl font-medium leading-relaxed">
              {phrase.sideA}
            </p>
          )}
        </div>

        <div className="my-4 border-t border-border" />

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("dictation.sideB")} · {t(LANGUAGE_KEYS[sideBLanguage])}
          </p>
          {revealed ? (
            <p className="whitespace-pre-wrap text-xl font-medium leading-relaxed">
              {phrase.sideB}
            </p>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
              {t("dictation.sideBHidden")}
            </p>
          )}
        </div>

        {listenMode && (
          <div className="mt-4 space-y-1.5">
            {timer.status === "alerted" ? (
              <p
                role="alert"
                className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger"
              >
                {t("dictation.timer.alert")}
              </p>
            ) : timer.status === "running" ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {t("dictation.timer.running", {
                      seconds: silenceSecondsLeft(timer),
                    })}
                  </span>
                  <span className="tabular-nums text-muted">
                    {timer.durationMs / 1000}s
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ${
                      timerProgress > 80 ? "bg-danger" : "bg-accent"
                    }`}
                    style={{ width: `${timerProgress}%` }}
                  />
                </div>
              </>
            ) : timer.status === "armed" ? (
              <p className="text-xs text-muted">
                {t("dictation.timer.armed")}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="min-h-10 rounded-lg border border-danger/40 px-3 text-xs font-semibold text-danger disabled:opacity-50"
          >
            {t("dictation.retry")}
          </button>
        </div>
      )}

      {audioError && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
          {audioSupported
            ? t("dictation.audioError")
            : t("dictation.audioUnsupported")}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPlay}
            disabled={busy || !audioSupported}
            className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {t("dictation.play")}
          </button>
          {!revealed && (
            <button
              type="button"
              onClick={onReveal}
              disabled={busy}
              className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
            >
              {t("dictation.reveal")}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1">
          {(["slow", "normal", "fast"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={speed === option}
              onClick={() => onSpeed(option)}
              disabled={busy}
              className={`min-h-10 rounded-lg px-2 text-xs font-medium disabled:opacity-50 ${
                speed === option
                  ? "bg-accent text-accent-foreground"
                  : "text-muted"
              }`}
            >
              {t(SPEED_KEYS[option])}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNext}
            disabled={busy}
            className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? t("dictation.generating") : t("dictation.next")}
          </button>
          {undoCount > 0 && (
            <button
              type="button"
              onClick={onUndo}
              disabled={busy}
              className="min-h-12 shrink-0 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
            >
              {t("dictation.undo", { count: undoCount })}
            </button>
          )}
        </div>
      </div>

      {entry.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
          {entry.warnings.map((warning) => (
            <li
              key={
                warning.code === "category_empty"
                  ? `category:${warning.category}`
                  : warning.code
              }
            >
              {warningText(warning, t)}
            </li>
          ))}
        </ul>
      )}

      <p className="hidden text-xs text-muted sm:block">
        {t("dictation.shortcuts")}
      </p>
    </section>
  );
}
