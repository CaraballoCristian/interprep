"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./dialog";
import { useI18n } from "./settings-provider";

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
};

const KEYBOARD_ROWS = [
  { keys: ["space", "Enter"], label: "study.helpFlip" },
  { keys: ["→"], label: "study.helpEasy" },
  { keys: ["←"], label: "study.helpHard" },
  { keys: ["↑"], label: "study.helpLearned" },
  { keys: ["↓"], label: "study.helpNew" },
  { keys: ["H"], label: "study.helpHide" },
  { keys: ["Z"], label: "study.helpUndo" },
  { keys: ["?"], label: "study.helpHelp" },
] as const;

const GESTURE_ROWS = [
  { icon: "🔄", label: "study.helpFlip" },
  { icon: "✅", label: "study.helpEasy" },
  { icon: "❌", label: "study.helpHard" },
  { icon: "🙈", label: "study.helpLearned" },
  { icon: "☠", label: "study.helpNew" },
] as const;

/** Device-aware help: keyboard on desktop, swipe gestures on touch screens. */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const { t } = useI18n();
  const [isTouch, setIsTouch] = useState(false);
  const titleId = "help-dialog-title";

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="space-y-4"
    >
      <div>
        <h2 id={titleId} className="text-lg font-semibold">
          {t("study.helpTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("study.helpIntro")}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {isTouch ? t("study.helpGestureTitle") : t("study.helpKeyboardTitle")}
        </h3>

        {isTouch ? (
          <ul className="space-y-2">
            {GESTURE_ROWS.map((row) => (
              <li
                key={row.label}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-background px-3"
              >
                <span aria-hidden="true" className="text-xl">
                  {row.icon}
                </span>
                <span className="text-sm">{t(row.label)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-2">
            {KEYBOARD_ROWS.map((row) => (
              <li
                key={row.label}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border bg-background px-3"
              >
                <span className="text-sm">{t(row.label)}</span>
                <span className="flex shrink-0 gap-1">
                  {row.keys.map((key) => (
                    <kbd
                      key={key}
                      className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs"
                    >
                      {key === "space" ? t("study.helpKeySpace") : key}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-muted">
          {isTouch ? t("study.helpGestureHint") : t("study.helpKeyboardHint")}
        </p>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-background p-3">
        <h3 className="text-sm font-semibold">{t("study.helpHide")}</h3>
        <p className="text-sm text-muted">{t("study.helpHideDetail")}</p>
      </section>

      <button
        type="button"
        onClick={onClose}
        className="min-h-12 w-full rounded-2xl border border-border px-5 text-sm font-medium"
      >
        {t("common.close")}
      </button>
    </Dialog>
  );
}
