"use client";

import { useState } from "react";
import type { RoundMode, RoundSummary } from "@lib/study/round";
import type { TranslationKey } from "@lib/i18n/dictionary";
import type { CardStatus } from "@lib/types";
import { useI18n } from "@/components/settings-provider";

const REVIEW_STATUSES: readonly CardStatus[] = ["new", "hard", "easy"];

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  easy: "status.easy",
  hard: "status.hard",
  learned: "status.learned",
};

type SummaryScreenProps = {
  summary: RoundSummary;
  mode: RoundMode;
  busy: boolean;
  onStartReview: (statuses: CardStatus[]) => void;
  onFinish: () => void;
  onNewRound: () => void;
};

export function SummaryScreen({
  summary,
  mode,
  busy,
  onStartReview,
  onFinish,
  onNewRound,
}: SummaryScreenProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<CardStatus[]>(["new", "hard"]);

  function toggle(status: CardStatus) {
    setSelected((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  const counts: Record<CardStatus, number> = {
    new: summary.newCount,
    easy: summary.easyCount,
    hard: summary.hardCount,
    learned: summary.learnedCount,
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-summary-title"
        className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-2xl"
      >
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {t("summary.roundFinished")}
          </p>
          <h1
            id="round-summary-title"
            className="mt-2 text-2xl font-semibold tracking-tight"
          >
            {t("summary.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("summary.cards", {
              seen: summary.seen,
              total: summary.total,
            })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label={t("summary.seen")} value={summary.seen} />
          <Stat
            label={t("summary.accuracy")}
            value={`${Math.round(summary.accuracy * 100)}%`}
          />
          <Stat
            label={t("summary.successes")}
            value={summary.successes}
            tone="success"
            icon="✓"
          />
          <Stat
            label={t("summary.failures")}
            value={summary.failures}
            tone="danger"
            icon="✕"
          />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(["new", "easy", "hard", "learned"] as const).map((status) => (
            <div
              key={status}
              className="rounded-xl border border-border bg-surface-2 px-2 py-2 text-center"
            >
              <p className="truncate text-[10px] text-muted">
                {t(STATUS_KEYS[status])}
              </p>
              <p className="text-lg font-semibold">{counts[status]}</p>
            </div>
          ))}
        </div>

        {mode === "standard" ? (
          <div className="space-y-2 rounded-2xl border border-border bg-surface-2 p-3">
            <div>
              <h2 className="text-sm font-semibold">
                {t("summary.reviewTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {t("summary.reviewDescription")}
              </p>
            </div>

            <div className="space-y-1">
              {REVIEW_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={selected.includes(status)}
                    disabled={busy}
                    onChange={() => toggle(status)}
                  />
                  <span className="text-sm">{t(STATUS_KEYS[status])}</span>
                  <span className="ml-auto text-xs text-muted">
                    {counts[status]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
            {t("filters.continuousShort")}
          </p>
        )}

        <div className="space-y-2">
          {mode === "standard" ? (
            <>
              <button
                type="button"
                onClick={() => onStartReview(selected)}
                disabled={busy || selected.length === 0}
                className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
              >
                {t("summary.start")}
              </button>
              <button
                type="button"
                onClick={onFinish}
                disabled={busy}
                className="min-h-12 w-full rounded-2xl border border-border px-5 text-sm font-medium disabled:opacity-50"
              >
                {t("summary.finish")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onFinish}
                disabled={busy}
                className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
              >
                {t("summary.finish")}
              </button>
              <button
                type="button"
                onClick={onNewRound}
                disabled={busy}
                className="min-h-12 w-full rounded-2xl border border-border px-5 text-sm font-medium disabled:opacity-50"
              >
                {t("summary.newRound")}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "danger";
  icon?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";

  return (
    <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>
        {icon && <span aria-hidden="true">{icon} </span>}
        {value}
      </p>
    </div>
  );
}
