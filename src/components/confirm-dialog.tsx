"use client";

import { useI18n } from "./settings-provider";
import { Dialog } from "./dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Styled replacement for `window.confirm` with accessible semantics. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const titleId = "confirm-dialog-title";
  const descriptionId = description ? "confirm-dialog-description" : undefined;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onCancel}
      labelledBy={titleId}
      className="space-y-4"
    >
      <div>
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1 text-sm text-muted">
            {description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`min-h-14 w-full rounded-2xl px-5 text-base font-semibold disabled:opacity-50 ${
            tone === "danger"
              ? "bg-danger text-white"
              : "bg-accent text-accent-foreground"
          }`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-12 w-full rounded-2xl border border-border px-5 text-sm font-medium disabled:opacity-50"
        >
          {t("common.cancel")}
        </button>
      </div>
    </Dialog>
  );
}
