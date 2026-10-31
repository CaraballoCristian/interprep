"use client";

import { useDrag } from "@use-gesture/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import type {
  StudyCard as StudyCardModel,
  StudyConfig,
} from "@lib/study/types";
import {
  CARD_STATUSES,
  type CardResult,
  type CardStatus,
  type SideField,
} from "@lib/types";

const SWIPE_THRESHOLD = 80;

const STATUS_LABELS: Record<CardStatus, string> = {
  new: "Nueva",
  learning: "Aprendiendo",
  learned: "Aprendida",
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
  if (history.length === 0) {
    return <span className="text-xs text-muted">Sin historial</span>;
  }

  const successes = history.filter((result) => result === "s").length;
  const failures = history.length - successes;

  return (
    <span
      className="flex items-center gap-1 text-sm"
      aria-label={`Historial: ${successes} aciertos y ${failures} fallos de ${history.length}`}
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
  busy: boolean;
  onFlip: () => void;
  onResult: (result: CardResult) => void;
  onHide: () => void;
  onStatusChange: (status: CardStatus) => void;
};

export function StudyCardView({
  card,
  config,
  flipped,
  busy,
  onFlip,
  onResult,
  onHide,
  onStatusChange,
}: StudyCardProps) {
  const reducedMotion = useReducedMotion();
  const movedRef = useRef(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });

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

    if (!horizontal && my < 0) {
      onHide();
      return;
    }

    if (horizontal && flipped) {
      onResult(mx > 0 ? "s" : "f");
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

  let overlay: { icon: string; label: string; className: string } | null =
    null;

  if (drag.active && distance > 8) {
    if (!horizontal && drag.y < 0) {
      overlay = {
        icon: "🙈",
        label: "Ocultar",
        className: "border-border bg-surface-2 text-foreground",
      };
    } else if (horizontal && flipped) {
      overlay =
        drag.x > 0
          ? {
              icon: "✓",
              label: "Acierto",
              className: "border-success/50 bg-success/15 text-success",
            }
          : {
              icon: "✕",
              label: "Fallo",
              className: "border-danger/50 bg-danger/15 text-danger",
            };
    } else if (horizontal) {
      overlay = {
        icon: "↔",
        label: "Volteá para evaluar",
        className: "border-border bg-surface-2 text-muted",
      };
    }
  }

  const transform =
    reducedMotion || (!drag.active && drag.x === 0 && drag.y === 0)
      ? undefined
      : `translate3d(${drag.x}px, ${drag.y}px, 0) rotate(${drag.x / 24}deg)`;

  return (
    <div className="relative h-[min(60vh,540px)] w-full">
      <div
        {...bind()}
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Ver la pregunta" : "Ver la respuesta"}
        onClick={handleClick}
        className="relative flex h-full touch-pan-y select-none flex-col rounded-3xl border border-border bg-surface p-5 shadow-xl"
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

        <div className="flex items-center justify-between gap-3">
          <HistoryIcons history={card.history} />
          <span className="text-xs uppercase tracking-[0.15em] text-muted">
            {flipped ? "Respuesta" : "Pregunta"}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-y-auto py-4">
          <div className="w-full [perspective:1000px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={flipped ? "side-b" : "side-a"}
                initial={
                  reducedMotion ? undefined : { rotateY: -90, opacity: 0 }
                }
                animate={
                  reducedMotion ? undefined : { rotateY: 0, opacity: 1 }
                }
                exit={reducedMotion ? undefined : { rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full"
                style={{ transformStyle: "preserve-3d" }}
              >
                <SideContent
                  card={card}
                  fields={flipped ? config.sideB : config.sideA}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div
          className="mt-2"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="grid grid-cols-3 gap-1"
            role="group"
            aria-label="Estado de la tarjeta"
          >
            {CARD_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                disabled={busy}
                aria-pressed={card.status === status}
                className={`min-h-11 rounded-lg border px-1 text-xs font-medium ${
                  card.status === status
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-surface-2 text-muted"
                }`}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
