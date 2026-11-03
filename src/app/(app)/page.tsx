"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StudyAction, StudyView } from "@lib/study/session";
import type { CardStatus } from "@lib/types";
import { useI18n } from "@/components/settings-provider";
import { HelpDialog } from "@/components/help-dialog";
import { matchesShortcut } from "@/config/keyboard";
import { StudyCardView } from "@/components/study/study-card";
import { SummaryScreen } from "@/components/study/summary-screen";

export default function StudyPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<StudyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const busyRef = useRef(false);
  const loadedRef = useRef(false);

  const readError = useCallback(
    (data: unknown): string => {
      const code =
        typeof data === "object" && data !== null && "error" in data
          ? (data as { error?: string }).error
          : undefined;

      switch (code) {
        case "not_revealed":
          return t("study.error.notRevealed");
        case "undo_unavailable":
          return t("study.error.undoUnavailable");
        case "no_current_card":
          return t("study.error.noCurrentCard");
        case "no_review_cards":
          return t("study.error.noReviewCards");
        default:
          return t("study.error.generic");
      }
    },
    [t],
  );

  const act = useCallback(
    async (action: StudyAction): Promise<StudyView | null> => {
      if (busyRef.current) {
        return null;
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

        const next = data as StudyView;
        setView(next);
        return next;
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : t("study.error.generic"),
        );
        return null;
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
          loadedRef.current = true;
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

  // Leaving the screen preserves the round and asks to resume on return.
  useEffect(() => {
    return () => {
      if (!loadedRef.current) {
        return;
      }
      void fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "leave" } satisfies StudyAction),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, []);

  const requestStatus = useCallback(
    (status: CardStatus) => {
      if (!view?.revealed) {
        setError(t("study.error.notRevealed"));
        return;
      }
      void act({ type: "status", status });
    },
    [act, t, view?.revealed],
  );

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

      if (matchesShortcut(event, "help")) {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      if (helpOpen || view.resumePending) {
        return;
      }

      if (matchesShortcut(event, "undo") && view.undoAvailable) {
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

      const status = matchesShortcut(event, "easy")
        ? "easy"
        : matchesShortcut(event, "hard")
          ? "hard"
          : matchesShortcut(event, "learned")
            ? "learned"
            : matchesShortcut(event, "new")
              ? "new"
              : null;

      if (status) {
        event.preventDefault();
        requestStatus(status);
        return;
      }

      if (matchesShortcut(event, "hide")) {
        event.preventDefault();
        void act({ type: "hide" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [act, helpOpen, requestStatus, view]);

  if (!view) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center justify-center px-4 md:max-w-2xl">
        <p className="text-sm text-muted">{error ?? t("study.loading")}</p>
      </main>
    );
  }

  const progressPercent =
    view.progress.total === 0
      ? 0
      : Math.round((view.progress.seen / view.progress.total) * 100);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-4 pt-4 md:max-w-2xl">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-base font-semibold">{t("common.study")}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={t("study.tooltip.help")}
              title={t("study.tooltip.help")}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-border text-base font-semibold text-muted"
            >
              ?
            </button>
            <span className="text-sm font-medium tabular-nums">
              {view.progress.seen} / {view.progress.total}
            </span>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-success">✓ {view.metrics.successes}</span>
          <span className="text-danger">✕ {view.metrics.failures}</span>
          <span className="text-accent">
            {t("study.learnedCount", { count: view.metrics.learned })}
          </span>
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
          mode={view.mode}
          busy={busy}
          onStartReview={(statuses) =>
            void act({ type: "review", statuses })
          }
          onFinish={() => {
            void act({ type: "finish" }).then((next) => {
              if (next) {
                router.push("/library");
              }
            });
          }}
          onNewRound={() => void act({ type: "new-round" })}
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
              revealed={view.revealed}
              busy={busy}
              onFlip={() =>
                void act({ type: "flip", flipped: !view.flipped })
              }
              onHide={() => void act({ type: "hide" })}
              onStatusChange={requestStatus}
              onNotRevealed={() => setError(t("study.error.notRevealed"))}
            />
          </div>

          <div className="flex min-h-12 items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {view.revealed
                ? t("study.hintFlipped")
                : t("study.hintUnflipped")}
            </p>
            {view.undoAvailable && (
              <button
                type="button"
                onClick={() => void act({ type: "undo" })}
                disabled={busy}
                title={t("study.tooltip.undo")}
                className="min-h-12 shrink-0 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
              >
                {t("study.undo", { count: view.undoCount })}
              </button>
            )}
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
            title={t("study.tooltip.newRound")}
            className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {t("study.newRound")}
          </button>
        </section>
      )}

      {view.resumePending && !view.summary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="resume-title"
            className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-2xl"
          >
            <div>
              <h2 id="resume-title" className="text-lg font-semibold">
                {t("study.resume.title")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t("study.resume.description")}
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void act({ type: "resume" })}
                disabled={busy}
                title={t("study.resume.tooltip.continue")}
                className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
              >
                {t("study.resume.continue")}
              </button>
              <button
                type="button"
                onClick={() => void act({ type: "reset" })}
                disabled={busy}
                title={t("study.resume.tooltip.restart")}
                className="min-h-12 w-full rounded-2xl border border-border px-5 text-sm font-medium disabled:opacity-50"
              >
                {t("study.resume.restart")}
              </button>
            </div>
          </section>
        </div>
      )}

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
