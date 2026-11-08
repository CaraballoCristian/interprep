"use client";

import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type {
  StudyCard as StudyCardModel,
  StudyConfig,
} from "@lib/study/types";
import {
  orderSideFields,
  STATUS_DIRECTION,
  EXIT_DURATION_MS,
  type SwipeDirection,
} from "@lib/study/config";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { type CardResult, type CardStatus, type SideField } from "@lib/types";
import { SpeakButton } from "@/components/speech/speak-button";
import { useI18n } from "@/components/settings-provider";

const SWIPE_THRESHOLD = 80;

const EXIT_TRANSFORM: Record<SwipeDirection, string> = {
  left: "translate3d(-120%, 0, 0) rotate(-8deg)",
  right: "translate3d(120%, 0, 0) rotate(8deg)",
  up: "translate3d(0, -120%, 0)",
  down: "translate3d(0, 120%, 0)",
};

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  easy: "status.easy",
  hard: "status.hard",
  learned: "status.learned",
};

const STATUS_ICONS: Record<CardStatus, string> = {
  learned: "🙈",
  new: "☠",
  hard: "❌",
  easy: "✅",
};

const STATUS_TOOLTIP_KEYS: Record<CardStatus, TranslationKey> = {
  new: "study.tooltip.new",
  easy: "study.tooltip.easy",
  hard: "study.tooltip.hard",
  learned: "study.tooltip.learned",
};

function fieldValue(card: StudyCardModel, field: SideField): string {
  switch (field) {
    case "termEng":
      return card.termEng;
    case "termEsp":
      return card.termEsp;
    case "description":
      return card.description;
  }
}

function SideContent({
  card,
  fields,
}: {
  card: StudyCardModel;
  fields: SideField[];
}) {
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const value = fieldValue(card, field);
        if (!value) {
          return null;
        }

        return field === "description" ? (
          <p
            key={field}
            className="whitespace-pre-wrap text-base leading-relaxed text-muted"
          >
            {value}
          </p>
        ) : (
          <div
            key={field}
            className="flex items-center justify-center gap-2"
          >
            <p className="text-3xl font-semibold leading-tight tracking-tight">
              {value}
            </p>
            <SpeakButton
              text={value}
              language={field === "termEng" ? "en" : "es"}
            />
          </div>
        );
      })}
    </div>
  );
}

function HistoryIcons({ history }: { history: CardResult[] }) {
  const { t } = useI18n();

  if (history.length === 0) {
    return <span className="text-xs text-muted">{t("study.noHistory")}</span>;
  }

  const successes = history.filter((result) => result === "s").length;
  const failures = history.length - successes;

  return (
    <span
      className="flex items-center gap-1 text-sm"
      aria-label={t("study.historyLabel", {
        successes,
        failures,
        total: history.length,
      })}
    >
      {history.map((result, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={result === "s" ? "text-success" : "text-danger"}
        >
          {result === "s" ? "✓" : "✕"}
        </span>
      ))}
    </span>
  );
}

type StudyCardProps = {
  card: StudyCardModel;
  config: StudyConfig;
  flipped: boolean;
  revealed: boolean;
  busy: boolean;
  exitDirection: SwipeDirection | null;
  onFlip: () => void;
  onHide: () => void;
  onStatusChange: (status: CardStatus) => void;
  onNotRevealed: () => void;
};

export function StudyCardView({
  card,
  config,
  flipped,
  revealed,
  busy,
  exitDirection,
  onFlip,
  onHide,
  onStatusChange,
  onNotRevealed,
}: StudyCardProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const movedRef = useRef(false);
  const contentScrolledRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [contentOverflow, setContentOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Reset the finger offset whenever the card changes or the exit animation
  // finishes, so the next card always starts centered.
  useEffect(() => {
    if (!exitDirection) {
      setDrag({ x: 0, y: 0, active: false });
    }
  }, [card.id, exitDirection]);

  // A new side starts collapsed so the card always owns vertical swipes.
  useEffect(() => {
    setExpanded(false);
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [card.id, flipped]);

  // Long descriptions are clipped until the user asks to read them. While
  // collapsed the card keeps `touch-none`, so vertical swipes on the text
  // reach the status gestures instead of being consumed by the browser.
  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const update = () => {
      setContentOverflow(element.scrollHeight > element.clientHeight + 1);
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild);
    }

    return () => observer.disconnect();
  }, [flipped, card.id]);

  // Chrome treats the text area as a pan surface even when it does not
  // overflow, which cancels the pointer stream that useDrag listens to.
  // A non-passive touchmove listener keeps the browser out of the gesture
  // unless the description is expanded and can actually scroll.
  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) {
      return;
    }

    let startX = 0;
    let startY = 0;
    let decided = false;
    let allowScroll = false;
    let startedInContent = false;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      decided = false;
      allowScroll = false;
      startedInContent =
        contentRef.current?.contains(event.target as Node) ?? false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];

      if (!decided) {
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // Wait for a clear direction, but keep the browser from starting a
        // scroll before we know whether the card should own the gesture.
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
          if (event.cancelable) {
            event.preventDefault();
          }
          return;
        }

        decided = true;

        const content = contentRef.current;
        if (
          expanded &&
          startedInContent &&
          content &&
          Math.abs(dy) >= Math.abs(dx)
        ) {
          const canScrollDown =
            content.scrollTop + content.clientHeight <
            content.scrollHeight - 1;
          const canScrollUp = content.scrollTop > 0;
          allowScroll = dy < 0 ? canScrollDown : canScrollUp;

          if (allowScroll) {
            contentScrolledRef.current = true;
          }
        }
      }

      if (!allowScroll && event.cancelable) {
        event.preventDefault();
      }
    };

    cardElement.addEventListener("touchstart", onTouchStart, { passive: true });
    cardElement.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      cardElement.removeEventListener("touchstart", onTouchStart);
      cardElement.removeEventListener("touchmove", onTouchMove);
    };
  }, [expanded]);

  function choose(status: CardStatus) {
    if (!revealed) {
      onNotRevealed();
      return;
    }
    onStatusChange(status);
  }

  const bind = useDrag(({ down, movement: [mx, my], last }) => {
    if (down) {
      movedRef.current = false;
      contentScrolledRef.current = false;
    }
    if (Math.abs(mx) > 6 || Math.abs(my) > 6) {
      movedRef.current = true;
    }

    if (!last) {
      setDrag({ x: down ? mx : 0, y: down ? my : 0, active: down });
      return;
    }

    // The gesture ended. Keep the finger offset when a status is chosen so
    // the exit animation continues from the current position instead of
    // snapping back to the center first.
    const horizontal = Math.abs(mx) > Math.abs(my);
    const distance = Math.max(Math.abs(mx), Math.abs(my));

    if (distance < SWIPE_THRESHOLD || !revealed || contentScrolledRef.current) {
      setDrag({ x: 0, y: 0, active: false });
      if (distance >= SWIPE_THRESHOLD && !revealed) {
        onNotRevealed();
      }
      return;
    }

    setDrag({ x: mx, y: my, active: false });
    choose(
      horizontal ? (mx > 0 ? "easy" : "hard") : my < 0 ? "learned" : "new",
    );
  });

  function handleClick() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onFlip();
  }

  const horizontal = Math.abs(drag.x) >= Math.abs(drag.y);
  const distance = horizontal ? Math.abs(drag.x) : Math.abs(drag.y);
  const overlayOpacity = Math.min(1, distance / SWIPE_THRESHOLD);

  let overlay: { icon: string; label: string; className: string } | null = null;

  if (drag.active && distance > 8) {
    if (!revealed) {
      overlay = {
        icon: "🔄",
        label: t("study.swipe.flipFirst"),
        className: "border-border bg-surface-2 text-muted",
      };
    } else {
      const status: CardStatus = horizontal
        ? drag.x > 0
          ? "easy"
          : "hard"
        : drag.y < 0
          ? "learned"
          : "new";

      overlay = {
        icon: STATUS_ICONS[status],
        label: t(STATUS_KEYS[status]),
        className:
          status === "easy"
            ? "border-success/50 bg-success/15 text-success"
            : status === "hard"
              ? "border-danger/50 bg-danger/15 text-danger"
              : status === "learned"
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border bg-surface-2 text-foreground",
      };
    }
  }

  const transform =
    reducedMotion || (!drag.active && drag.x === 0 && drag.y === 0)
      ? undefined
      : `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.x / 24}deg)`;

  const exitStyle = exitDirection
    ? {
        transform: EXIT_TRANSFORM[exitDirection],
        opacity: 0,
        pointerEvents: "none" as const,
        transition: `transform ${EXIT_DURATION_MS}ms ease-in, opacity ${EXIT_DURATION_MS}ms ease-in`,
      }
    : null;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col justify-center overflow-hidden">
      <div
        {...bind()}
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={flipped ? t("study.showQuestion") : t("study.showAnswer")}
        title={t("study.tooltip.flip")}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onFlip();
          }
        }}
        className="relative flex h-full max-h-[560px] w-full touch-none select-none flex-col overflow-hidden rounded-3xl border border-border bg-surface p-3 shadow-xl md:p-4"
        style={
          exitStyle ?? {
            transform,
            transition: drag.active
              ? "none"
              : "transform 200ms ease, opacity 200ms ease",
          }
        }
      >
        {overlay && (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
            style={{ opacity: overlayOpacity }}
          >
            <div
              className={`flex flex-col items-center gap-1 rounded-2xl border px-5 py-3 ${overlay.className}`}
            >
              <span aria-hidden="true" className="text-3xl">
                {overlay.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide">
                {overlay.label}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="max-w-[12rem] truncate rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {card.category || t("study.uncategorized")}
            </span>
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
              {t("field.status")}: {t(STATUS_KEYS[card.status])}
            </span>
          </div>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onHide();
            }}
            disabled={busy}
            title={t("study.tooltip.hide")}
            className="min-h-10 shrink-0 rounded-lg border border-border px-2.5 text-[11px] font-medium text-muted disabled:opacity-50 md:min-h-12 md:rounded-xl md:px-3 md:text-xs"
          >
            {t("study.hide")}
          </button>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3">
          <HistoryIcons history={card.history} />
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.15em] text-muted">
              {flipped ? t("study.answer") : t("study.question")}
            </span>
            {contentOverflow && (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((value) => {
                    if (value && contentRef.current) {
                      contentRef.current.scrollTop = 0;
                    }
                    return !value;
                  });
                }}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted"
              >
                {expanded ? t("study.showLess") : t("study.showMore")}
              </button>
            )}
          </div>
        </div>

        <div
          ref={contentRef}
          style={
            contentOverflow && !expanded
              ? {
                  maskImage:
                    "linear-gradient(to bottom, #000 82%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 82%, transparent 100%)",
                }
              : undefined
          }
          className={`flex min-h-0 flex-1 overflow-x-hidden py-2 md:py-4 ${
            expanded && contentOverflow
              ? "touch-pan-y items-start overflow-y-auto overscroll-contain"
              : contentOverflow
                ? "touch-none items-start overflow-hidden"
                : "touch-none items-center overflow-hidden"
          }`}
        >
          <div className="w-full overflow-x-hidden [perspective:1000px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={flipped ? "side-b" : "side-a"}
                initial={
                  reducedMotion ? undefined : { rotateY: -90, opacity: 0 }
                }
                animate={reducedMotion ? undefined : { rotateY: 0, opacity: 1 }}
                exit={reducedMotion ? undefined : { rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full"
                style={{ transformStyle: "preserve-3d" }}
              >
                <SideContent
                  card={card}
                  fields={orderSideFields(flipped ? config.sideB : config.sideA)}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div
          className="mt-1"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {/*
            Layout mirrors the arrow keys so the mapping is obvious:
            ↑ learned on top, then ← hard, ↓ new, → easy.
          */}
          <div
            className="grid grid-cols-3 gap-1.5"
            role="group"
            aria-label={t("study.statusGroup")}
          >
            <span aria-hidden="true" />

            <StatusButton
              status="learned"
              icon="🙈"
              direction={STATUS_DIRECTION.learned}
              active={card.status === "learned"}
              busy={busy}
              onClick={() => choose("learned")}
            />

            <span aria-hidden="true" />

            <StatusButton
              status="hard"
              icon="❌"
              direction={STATUS_DIRECTION.hard}
              active={card.status === "hard"}
              busy={busy}
              onClick={() => choose("hard")}
            />

            <StatusButton
              status="new"
              icon="☠"
              direction={STATUS_DIRECTION.new}
              active={card.status === "new"}
              busy={busy}
              onClick={() => choose("new")}
            />

            <StatusButton
              status="easy"
              icon="✅"
              direction={STATUS_DIRECTION.easy}
              active={card.status === "easy"}
              busy={busy}
              onClick={() => choose("easy")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusButton({
  status,
  icon,
  direction,
  active,
  busy,
  onClick,
}: {
  status: CardStatus;
  icon: string;
  direction: "up" | "down" | "left" | "right";
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={active}
      aria-label={`${t(STATUS_KEYS[status])} (${direction})`}
      title={t(STATUS_TOOLTIP_KEYS[status])}
      className={`flex min-h-11 flex-col items-center justify-center rounded-xl border text-[11px] font-semibold disabled:opacity-50 md:min-h-12 ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface-2 text-muted"
      }`}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {icon}
      </span>
      {t(STATUS_KEYS[status])}
    </button>
  );
}
