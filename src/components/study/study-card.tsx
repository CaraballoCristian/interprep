"use client";

import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type {
  StudyCard as StudyCardModel,
  StudyConfig,
} from "@lib/study/types";
import { orderSideFields } from "@lib/study/config";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { type CardResult, type CardStatus, type SideField } from "@lib/types";
import { useI18n } from "@/components/settings-provider";

const SWIPE_THRESHOLD = 80;

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

/** Swipe direction for each status. */
const STATUS_DIRECTION: Record<CardStatus, "up" | "down" | "left" | "right"> = {
  learned: "up",
  new: "down",
  hard: "left",
  easy: "right",
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
          <p
            key={field}
            className="text-3xl font-semibold leading-tight tracking-tight"
          >
            {value}
          </p>
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
  onFlip,
  onHide,
  onStatusChange,
  onNotRevealed,
}: StudyCardProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const movedRef = useRef(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });

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
    }
    if (Math.abs(mx) > 6 || Math.abs(my) > 6) {
      movedRef.current = true;
    }

    setDrag({ x: down ? mx : 0, y: down ? my : 0, active: down });

    if (!last) {
      return;
    }

    const horizontal = Math.abs(mx) > Math.abs(my);
    const distance = Math.max(Math.abs(mx), Math.abs(my));
    if (distance < SWIPE_THRESHOLD) {
      return;
    }

    if (!revealed) {
      onNotRevealed();
      return;
    }

    if (horizontal) {
      choose(mx > 0 ? "easy" : "hard");
    } else {
      choose(my < 0 ? "learned" : "new");
    }
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

  return (
    <div className="relative h-[min(62vh,560px)] w-full overflow-hidden">
      <div
        {...bind()}
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
        className="relative flex h-full touch-pan-y select-none flex-col overflow-x-hidden rounded-3xl border border-border bg-surface p-4 shadow-xl"
        style={{
          transform,
          transition: drag.active ? "none" : "transform 200ms ease",
        }}
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
            className="min-h-12 shrink-0 rounded-xl border border-border px-3 text-xs font-medium text-muted disabled:opacity-50"
          >
            {t("study.hide")}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <HistoryIcons history={card.history} />
          <span className="text-xs uppercase tracking-[0.15em] text-muted">
            {flipped ? t("study.answer") : t("study.question")}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto py-4">
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
          <div
            className="grid grid-cols-3 gap-1.5"
            role="group"
            aria-label={t("study.statusGroup")}
          >
            {/* <button
              type="button"
              onClick={onFlip}
              disabled={busy}
              className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-border bg-surface-2 text-[11px] font-medium text-muted disabled:opacity-50"
              >
              <span aria-hidden="true" className="text-base leading-none">
              ⟳
              </span>
              {t("study.flip")}
              </button> */}

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

            {/* <span aria-hidden="true" /> */}
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
            {/*  <span aria-hidden="true" /> */}
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
      className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-[11px] font-semibold disabled:opacity-50 ${
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
