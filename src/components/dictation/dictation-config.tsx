"use client";

import { useState } from "react";
import {
  MAX_SILENCE_SECONDS,
  MIN_SILENCE_SECONDS,
  clampSilenceSeconds,
} from "@lib/dictation/config";
import {
  DICTATION_LENGTHS,
  DICTATION_SPEEDS,
  DICTATION_TERMS_BY_LENGTH,
  GENERAL_CATEGORY,
  type DictationCategoryInfo,
  type DictationConfig,
  type DictationDirection,
  type DictationLength,
  type DictationSpeed,
} from "@lib/dictation/types";
import { CARD_STATUSES, type CardStatus } from "@lib/types";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { useI18n } from "@/components/settings-provider";

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  easy: "status.easy",
  hard: "status.hard",
  learned: "status.learned",
};

const DIRECTION_KEYS: Record<DictationDirection, TranslationKey> = {
  "en-es": "dictation.direction.en-es",
  "es-en": "dictation.direction.es-en",
};

const LENGTH_KEYS: Record<DictationLength, TranslationKey> = {
  short: "dictation.length.short",
  medium: "dictation.length.medium",
  long: "dictation.length.long",
};

const SPEED_KEYS: Record<DictationSpeed, TranslationKey> = {
  slow: "dictation.speed.slow",
  normal: "dictation.speed.normal",
  fast: "dictation.speed.fast",
};

type KeyMessage = { tone: "ok" | "error"; text: string } | null;

type DictationConfigPanelProps = {
  config: DictationConfig;
  categories: DictationCategoryInfo[];
  hasApiKey: boolean;
  keyHint: string | null;
  model: string;
  saving: boolean;
  saveError: boolean;
  onChange: (patch: Partial<DictationConfig>) => void;
  onSaveKey: (apiKey: string) => Promise<boolean>;
  onClearKey: () => Promise<boolean>;
  onTestKey: () => Promise<"ok" | "error">;
};

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background px-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted">
            {description}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-lg px-2 text-xs font-medium ${
            value === option.value
              ? "bg-accent text-accent-foreground"
              : "text-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DictationConfigPanel({
  config,
  categories,
  hasApiKey,
  keyHint,
  model,
  saving,
  saveError,
  onChange,
  onSaveKey,
  onClearKey,
  onTestKey,
}: DictationConfigPanelProps) {
  const { t } = useI18n();
  const [apiKey, setApiKey] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMessage, setKeyMessage] = useState<KeyMessage>(null);

  const scenarioNames = categories
    .map((category) => category.name)
    .filter((name) => name !== GENERAL_CATEGORY);

  const selected =
    config.categories === null
      ? new Set(scenarioNames)
      : new Set(config.categories);

  const categorySummary =
    config.categories === null
      ? t("dictation.categoriesSummaryAll", { count: scenarioNames.length })
      : config.categories.length === 0
        ? t("dictation.categoriesSummaryNone")
        : t("dictation.categoriesSummaryCount", {
            selected: config.categories.length,
            total: scenarioNames.length,
          });

  function eligibleCount(name: string): number {
    const info = categories.find((category) => category.name === name);
    if (!info) {
      return 0;
    }
    return config.statuses.reduce(
      (total, status) => total + info.byStatus[status],
      0,
    );
  }

  function toggleCategory(name: string) {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    onChange({
      categories: scenarioNames.filter((candidate) => next.has(candidate)),
    });
  }

  function toggleStatus(status: CardStatus) {
    const next = config.statuses.includes(status)
      ? config.statuses.filter((candidate) => candidate !== status)
      : [...config.statuses, status];

    onChange({
      statuses: CARD_STATUSES.filter((candidate) =>
        next.includes(candidate),
      ),
    });
  }

  async function saveKey() {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      setKeyMessage({ tone: "error", text: t("dictation.geminiKeyInvalid") });
      return;
    }

    setKeyBusy(true);
    setKeyMessage(null);
    const ok = await onSaveKey(trimmed);
    setKeyBusy(false);

    if (ok) {
      setApiKey("");
      setKeyMessage({ tone: "ok", text: t("dictation.geminiKeySaved") });
    } else {
      setKeyMessage({ tone: "error", text: t("dictation.geminiKeyTestError") });
    }
  }

  async function testKey() {
    setKeyBusy(true);
    setKeyMessage(null);
    const result = await onTestKey();
    setKeyBusy(false);
    setKeyMessage({
      tone: result === "ok" ? "ok" : "error",
      text:
        result === "ok"
          ? t("dictation.geminiKeyTestOk")
          : t("dictation.geminiKeyTestError"),
    });
  }

  async function removeKey() {
    setKeyBusy(true);
    setKeyMessage(null);
    const ok = await onClearKey();
    setKeyBusy(false);
    setKeyMessage({
      tone: ok ? "ok" : "error",
      text: ok
        ? t("dictation.geminiKeyRemoved")
        : t("dictation.error.generic"),
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("dictation.configTitle")}</h2>
        <span className="text-xs text-muted">
          {saving
            ? t("dictation.configSaving")
            : saveError
              ? t("dictation.configSaveError")
              : t("dictation.configSaved")}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {t("dictation.categoriesTitle")}
          </h3>
          <span className="text-xs text-muted">{categorySummary}</span>
        </div>

        <details className="rounded-xl border border-border bg-background">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
            <span>{t("dictation.chooseCategories")}</span>
            <span className="text-xs font-normal text-muted">
              {categorySummary}
            </span>
          </summary>

          <div className="space-y-2 border-t border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ categories: null })}
                className="min-h-12 rounded-xl border border-border text-sm font-medium"
              >
                {t("dictation.all")}
              </button>
              <button
                type="button"
                onClick={() => onChange({ categories: [] })}
                className="min-h-12 rounded-xl border border-border text-sm font-medium"
              >
                {t("dictation.none")}
              </button>
            </div>

            {scenarioNames.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">
                {t("dictation.noCategories")}
              </p>
            ) : (
              <div className="space-y-1">
                {scenarioNames.map((name) => {
                  const count = eligibleCount(name);

                  return (
                    <label
                      key={name}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={selected.has(name)}
                        onChange={() => toggleCategory(name)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {name || t("dictation.uncategorized")}
                      </span>
                      <span
                        className={`text-xs ${
                          count === 0 ? "text-danger" : "text-muted"
                        }`}
                      >
                        {t("dictation.termCount", { count })}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      </div>

      <Toggle
        label={t("dictation.generalTitle")}
        description={t("dictation.generalDescription")}
        checked={config.includeGeneral}
        onChange={(includeGeneral) => onChange({ includeGeneral })}
      />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t("dictation.statusesTitle")}
        </h3>
        <div className="space-y-1">
          {CARD_STATUSES.map((status) => (
            <label
              key={status}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={config.statuses.includes(status)}
                onChange={() => toggleStatus(status)}
              />
              <span className="text-sm">{t(STATUS_KEYS[status])}</span>
            </label>
          ))}
        </div>
        {config.statuses.length === 0 && (
          <p className="text-sm text-danger">
            {t("dictation.statusesEmpty")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">
          {t("dictation.directionTitle")}
        </h3>
        <select
          value={config.direction}
          onChange={(event) =>
            onChange({
              direction: event.target.value as DictationDirection,
            })
          }
          className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
        >
          {(Object.keys(DIRECTION_KEYS) as DictationDirection[]).map(
            (direction) => (
              <option key={direction} value={direction}>
                {t(DIRECTION_KEYS[direction])}
              </option>
            ),
          )}
        </select>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("dictation.lengthTitle")}</h3>
        <Segmented
          value={config.length}
          ariaLabel={t("dictation.lengthTitle")}
          options={DICTATION_LENGTHS.map((length) => ({
            value: length,
            label: `${t(LENGTH_KEYS[length])} · ${DICTATION_TERMS_BY_LENGTH[length]}`,
          }))}
          onChange={(length) => onChange({ length })}
        />
        <p className="text-xs text-muted">
          {t("dictation.lengthTerms", {
            count: DICTATION_TERMS_BY_LENGTH[config.length],
          })}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("dictation.audioTitle")}</h3>
        <Toggle
          label={t("dictation.autoplay")}
          checked={config.autoplay}
          onChange={(autoplay) => onChange({ autoplay })}
        />
        <Toggle
          label={t("dictation.listenMode")}
          description={t("dictation.listenModeDescription")}
          checked={config.listenMode}
          onChange={(listenMode) => onChange({ listenMode })}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("dictation.speedTitle")}</h3>
        <Segmented
          value={config.speed}
          ariaLabel={t("dictation.speedTitle")}
          options={DICTATION_SPEEDS.map((speed) => ({
            value: speed,
            label: t(SPEED_KEYS[speed]),
          }))}
          onChange={(speed) => onChange({ speed })}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{t("dictation.timerTitle")}</h3>
        <p className="text-xs text-muted">
          {t("dictation.timerDescription")}
        </p>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3">
          <span className="text-sm font-medium">
            {t("dictation.timerSeconds")}
          </span>
          <input
            type="number"
            min={MIN_SILENCE_SECONDS}
            max={MAX_SILENCE_SECONDS}
            value={config.silenceSeconds}
            disabled={!config.listenMode}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) {
                onChange({ silenceSeconds: clampSilenceSeconds(value) });
              }
            }}
            className="h-10 w-20 rounded-lg border border-border bg-surface px-2 text-center text-sm tabular-nums disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-muted">
          {t("dictation.timerRange", {
            min: MIN_SILENCE_SECONDS,
            max: MAX_SILENCE_SECONDS,
          })}
        </p>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {t("dictation.geminiTitle")}
          </h3>
          <span className="text-xs text-muted">
            {hasApiKey
              ? t("dictation.geminiKeyConfigured", {
                  hint: keyHint ?? "????",
                })
              : t("dictation.geminiKeyMissing")}
          </span>
        </div>
        <p className="text-xs text-muted">
          {t("dictation.geminiDescription")}
        </p>
        <p className="text-xs text-muted">
          {t("dictation.geminiModel", { model })}
        </p>

        <label className="block space-y-1">
          <span className="text-xs font-medium">
            {t("dictation.geminiKeyLabel")}
          </span>
          <input
            type="password"
            value={apiKey}
            autoComplete="off"
            spellCheck={false}
            placeholder={t("dictation.geminiKeyPlaceholder")}
            onChange={(event) => setApiKey(event.target.value)}
            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void saveKey()}
            disabled={keyBusy || apiKey.trim().length < 10}
            className="min-h-12 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {t("dictation.geminiKeySave")}
          </button>
          <button
            type="button"
            onClick={() => void testKey()}
            disabled={keyBusy || !hasApiKey}
            className="min-h-12 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
          >
            {t("dictation.geminiKeyTest")}
          </button>
        </div>

        {hasApiKey && (
          <button
            type="button"
            onClick={() => void removeKey()}
            disabled={keyBusy}
            className="min-h-12 w-full rounded-xl border border-danger/40 px-3 text-sm font-medium text-danger disabled:opacity-50"
          >
            {t("dictation.geminiKeyRemove")}
          </button>
        )}

        {keyMessage && (
          <p
            role="status"
            className={`text-xs ${
              keyMessage.tone === "ok" ? "text-success" : "text-danger"
            }`}
          >
            {keyMessage.text}
          </p>
        )}

        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-accent underline"
        >
          {t("dictation.geminiKeyLink")}
        </a>
      </div>
    </section>
  );
}
