"use client";

import Link from "next/link";
import type { RoundSummary } from "@lib/study/round";

type SummaryScreenProps = {
  summary: RoundSummary;
  total: number;
  failedCount: number;
  undoAvailable: boolean;
  busy: boolean;
  onNewRound: () => void;
  onReviewFailed: () => void;
  onUndo: () => void;
};

export function SummaryScreen({
  summary,
  total,
  failedCount,
  undoAvailable,
  busy,
  onNewRound,
  onReviewFailed,
  onUndo,
}: SummaryScreenProps) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-6 py-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Vuelta terminada
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Resumen</h1>
        <p className="mt-1 text-sm text-muted">
          {summary.seen} de {total} tarjetas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Tarjetas vistas" value={summary.seen} />
        <Stat
          label="Aciertos"
          value={summary.successes}
          tone="success"
          icon="✓"
        />
        <Stat label="Fallos" value={summary.failures} tone="danger" icon="✕" />
        <Stat
          label="% de acierto"
          value={`${Math.round(summary.accuracy * 100)}%`}
        />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onNewRound}
          disabled={busy}
          className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
        >
          Nueva vuelta
        </button>

        {failedCount > 0 && (
          <button
            type="button"
            onClick={onReviewFailed}
            disabled={busy}
            className="min-h-12 w-full rounded-2xl border border-border bg-surface px-5 text-sm font-semibold disabled:opacity-50"
          >
            Repasar solo las falladas ({failedCount})
          </button>
        )}

        <Link
          href="/"
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-border px-5 text-sm font-medium"
        >
          Cambiar template / filtros
        </Link>

        {undoAvailable && (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy}
            className="min-h-12 w-full rounded-2xl px-5 text-sm font-medium text-muted underline underline-offset-4 disabled:opacity-50"
          >
            Deshacer la última acción
          </button>
        )}
      </div>
    </section>
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
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>
        {icon && <span aria-hidden="true">{icon} </span>}
        {value}
      </p>
    </div>
  );
}
