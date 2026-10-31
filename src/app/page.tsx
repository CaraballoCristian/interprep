"use client";

import Link from "next/link";
import { SettingsControls } from "@/components/settings-controls";
import { useI18n } from "@/components/settings-provider";

export default function Home() {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          {t("common.appName")}
        </p>
        <SettingsControls />
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("home.title")}
        </h1>
        <p className="text-base text-muted">{t("home.tagline")}</p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">{t("home.startTitle")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("home.startDescription")}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            href="/study"
          >
            {t("common.study")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/import"
          >
            {t("nav.import")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/filters"
          >
            {t("nav.filters")}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/library"
          >
            {t("nav.library")}
          </Link>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/api/health"
          >
            /api/health
          </a>
        </div>
      </section>
    </main>
  );
}
