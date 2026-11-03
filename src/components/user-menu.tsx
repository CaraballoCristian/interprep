"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "./settings-provider";

export type SessionUserView = {
  name: string;
  email: string;
  image: string | null;
};

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const value =
    parts.length > 1
      ? `${parts[0][0]}${parts[1][0]}`
      : source.slice(0, 2);
  return value.toUpperCase();
}

export function UserMenu({
  user,
  compact = false,
}: {
  user: SessionUserView;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const avatar = initials(user.name, user.email);

  async function signOut() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        aria-label={t("auth.signOut")}
        title={t("auth.signOut")}
        className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-xs font-semibold text-muted disabled:opacity-50"
      >
        <span aria-hidden="true">{busy ? "…" : avatar}</span>
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 bg-cover bg-center text-xs font-semibold text-accent"
          style={
            user.image
              ? { backgroundImage: `url("${user.image}")` }
              : undefined
          }
        >
          {user.image ? "" : avatar}
        </span>
        <div className="min-w-0">
          {user.name.trim() !== "" && (
            <p className="truncate text-sm font-medium">{user.name}</p>
          )}
          <p className="truncate text-xs text-muted" title={user.email}>
            {user.email}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        className="min-h-10 w-full rounded-lg border border-border px-3 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
