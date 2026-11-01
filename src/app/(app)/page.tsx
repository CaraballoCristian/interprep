"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyAction, StudyView } from "@lib/study/session";
import { useI18n } from "@/components/settings-provider";
import { matchesShortcut } from "@/config/keyboard";
import { StudyCardView } from "@/components/study/study-card";
import { SummaryScreen } from "@/components/study/summary-screen";

export default function StudyPage() {
  const { t } = useI18n();
  const [view, setView] = useState<StudyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busyRef = useRef(false);

  const readError = useCallback(
    (data: unknown): string => {
      const code =
        typeof data === "object" && data !== null && "error" in data
          ? (data as { error?: string }).error
          : undefined;

      switch (code) {
        case "not_flipped":
          return t("study.error.notFlipped");
        case "undo_unavailable":
          return t("study.error.undoUnavailable");
        case "no_current_card":
          return t("study.error.noCurrentCard");
        case "no_failed_cards":
          return t("study.error.noFailedCards");
        default:
          return t("study.error.generic");
      }
    },
    [t],
  );

  const act = useCallback(
    async (action: StudyAction) => {
      if (busyRef.current) {
        return;
      }

      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });

        const data: unknown = await response.json();

        if (!response.ok) {
          throw new Error(readError(data));
        }

        setView(data as StudyView);
        setNow(Date.now());
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : t("study.error.generic"),
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [readError, t],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/study", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(t("study.error.load"));
        }
        const data = (await response.json()) as StudyView;
        if (!cancelled) {
          setView(data);
          setNow(Date.now());
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : t("study.error.load"),
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const undoVisible =
    view?.undoAvailable === true &&
    view.undoExpiresAt !== null &&
    now < view.undoExpiresAt;

  useEffect(() => {
    if (!undoVisible) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [undoVisible]);

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

      if (!view) {
        return;
      }

      // Undo stays available on the summary screen; the other shortcuts
      // need a current card.
      if (matchesShortcut(event, "undo") && undoVisible) {
        event.preventDefault();
        void act({ type: "undo" });
        return;
      }

      if (!view.card || view.summary || view.emptyDeck) {
        return;
      }

      if (matchesShortcut(event, "flip")) {
        event.preventDefault();
        void act({ type: "flip", flipped: !view.flipped });
        return;
      }

      if (matchesShortcut(event, "success")) {
        if (view.flipped) {
          event.preventDefault();
          void act({ type: "result", result: "s" });
        }
        return;
      }

      if (matchesShortcut(event, "fail")) {
        if (view.flipped) {
          event.preventDefault();
          void act({ type: "result", result: "f" });
        }
        return;
      }

      if (matchesShortcut(event, "hide")) {
        event.preventDefault();
        void act({ type: "hide" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [act, view, undoVisible]);

  if (!view) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center px-4 md:max-w-2xl">
        <p className="text-sm text-muted">
          {error ?? t("study.loading")}
        </p>
      </main>
    );
  }

  const progressPercent =
    view.progress.total === 0
      ? 0
      : Math.round((view.progress.seen / view.progress.total) * 100);

  const undoSeconds =
    view.undoExpiresAt === null
      ? 0
      : Math.max(0, Math.ceil((view.undoExpiresAt - now) / 1000));

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-4 pt-4 md:max-w-2xl">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold">{t("common.study")}</h1>
          <span className="text-sm font-medium tabular-nums">
            {view.progress.index} / {view.progress.total}
          </span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-success">✓ {view.metrics.successes}</span>
          <span className="text-danger">✕ {view.metrics.failures}</span>
          <span className="text-muted">
            {t("study.accuracy", {
              value: Math.round(view.metrics.accuracy * 100),
            })}
          </span>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {view.summary ? (
        <SummaryScreen
          summary={view.summary}
          total={view.progress.total}
          failedCount={view.failedIds.length}
          undoAvailable={undoVisible}
          busy={busy}
          onNewRound={() => void act({ type: "new-round" })}
          onReviewFailed={() => void act({ type: "review-failed" })}
          onUndo={() => void act({ type: "undo" })}
        />
      ) : view.emptyDeck ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{t("study.emptyTitle")}</p>
            <p className="text-sm text-muted">
              {t("study.emptyDescription")}
            </p>
          </div>
          <Link
            href="/import"
            className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
          >
            {t("nav.import")}
          </Link>
          <Link
            href="/library"
            className="flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
          >
            {t("study.goLibrary")}
          </Link>
          <Link
            href="/filters"
            className="flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
          >
            {t("study.changeFilters")}
          </Link>
        </section>
      ) : view.card ? (
        <>
          <div className="flex flex-1 flex-col justify-center py-4">
            <StudyCardView
              card={view.card}
              config={view.config}
              flipped={view.flipped}
              busy={busy}
              onFlip={() =>
                void act({ type: "flip", flipped: !view.flipped })
              }
              onResult={(result) => void act({ type: "result", result })}
              onHide={() => void act({ type: "hide" })}
              onStatusChange={(status) =>
                void act({ type: "status", status })
              }
            />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <ActionButton
                label={t("study.fail")}
                icon="✕"
                tone="danger"
                disabled={!view.flipped || busy}
                onClick={() => void act({ type: "result", result: "f" })}
              />
              <ActionButton
                label={t("study.hide")}
                icon="🙈"
                tone="neutral"
                disabled={busy}
                onClick={() => void act({ type: "hide" })}
              />
              <ActionButton
                label={t("study.success")}
                icon="✓"
                tone="success"
                disabled={!view.flipped || busy}
                onClick={() => void act({ type: "result", result: "s" })}
              />
            </div>

            <div className="flex min-h-12 items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {view.flipped
                  ? t("study.hintFlipped")
                  : t("study.hintUnflipped")}
              </p>
              {undoVisible && (
                <button
                  type="button"
                  onClick={() => void act({ type: "undo" })}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                >
                  {t("study.undo", { seconds: undoSeconds })}
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{t("study.noCardTitle")}</p>
            <p className="text-sm text-muted">
              {t("study.noCardDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void act({ type: "new-round" })}
            disabled={busy}
            className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {t("study.newRound")}
          </button>
        </section>
      )}
    </main>
  );
}

function ActionButton({
  label,
  icon,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  tone: "success" | "danger" | "neutral";
  disabled: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "border-success/40 bg-success/15 text-success"
      : tone === "danger"
        ? "border-danger/40 bg-danger/15 text-danger"
        : "border-border bg-surface-2 text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border text-xs font-semibold disabled:opacity-40 ${toneClass}`}
    >
      <span aria-hidden="true" className="text-xl leading-none">
        {icon}
      </span>
      {label}
    </button>
  );
}
