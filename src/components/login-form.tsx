"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "./settings-provider";

type LoginFormProps = {
  nextPath: string;
  accessDenied: boolean;
  signedInAs: string | null;
  failed: boolean;
};

export function LoginForm({
  nextPath,
  accessDenied,
  signedInAs,
  failed,
}: LoginFormProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed);

  async function signInWithGoogle() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(false);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: nextPath,
        errorCallbackURL: "/login?error=auth",
      });

      if (result?.error) {
        setError(true);
        setBusy(false);
      }
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await authClient.signOut();
      window.location.href = "/login";
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
          {t("common.appName")}
        </p>
        <h1 className="text-2xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted">{t("auth.loginDescription")}</p>
      </div>

      {accessDenied && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
        >
          <p>{t("auth.accessDenied")}</p>
          {signedInAs && (
            <p className="text-muted">
              {t("auth.signedInAs", { email: signedInAs })}
            </p>
          )}
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={busy}
            className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
          >
            {t("auth.signOut")}
          </button>
        </div>
      )}

      {error && !accessDenied && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
        >
          {t("auth.error")}
        </p>
      )}

      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        disabled={busy || accessDenied}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
      >
        <GoogleIcon />
        {busy ? t("auth.redirecting") : t("auth.google")}
      </button>

      <p className="text-center text-xs text-muted">{t("auth.secureNote")}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.4 14.5a7.2 7.2 0 0 1 0-4.6V6.8H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.8l4 3.1A7 7 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
