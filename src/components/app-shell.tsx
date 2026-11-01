"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { SettingsControls } from "./settings-controls";
import { useI18n } from "./settings-provider";

type NavIconName = "study" | "import" | "filters" | "library";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: NavIconName;
};

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", labelKey: "common.study", icon: "study" },
  { href: "/import", labelKey: "nav.import", icon: "import" },
  { href: "/filters", labelKey: "nav.filters", icon: "filters" },
  { href: "/library", labelKey: "nav.library", icon: "library" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavIcon({ name }: { name: NavIconName }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-6 w-6 shrink-0",
    "aria-hidden": true,
  };

  switch (name) {
    case "study":
      return (
        <svg {...props}>
          <rect x="3" y="6" width="13" height="14" rx="2" />
          <path d="M7 3h10a2 2 0 0 1 2 2v12" />
          <path d="M7 11h5" />
        </svg>
      );
    case "import":
      return (
        <svg {...props}>
          <path d="M12 3v11" />
          <path d="m7 9 5 5 5-5" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
      );
    case "filters":
      return (
        <svg {...props}>
          <path d="M4 7h6" />
          <path d="M14 7h6" />
          <circle cx="12" cy="7" r="2" />
          <path d="M4 17h10" />
          <path d="M18 17h2" />
          <circle cx="16" cy="17" r="2" />
        </svg>
      );
    case "library":
      return (
        <svg {...props}>
          <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z" />
          <path d="M8 3v18" />
          <path d="M12 7h4" />
        </svg>
      );
  }
}

/**
 * Persistent navigation shell. On mobile it renders a top bar and a bottom tab
 * bar; from `lg` up it becomes a sidebar with a wide content area. Routes stay
 * real URLs, so back/forward, deep links and the PWA keep working.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur md:hidden">
        <Link
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.2em] text-muted"
        >
          {t("common.appName")}
        </Link>
        <SettingsControls />
      </header>

      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface md:px-4 md:py-6">
        <Link
          href="/"
          className="px-2 text-sm font-semibold uppercase tracking-[0.2em] text-muted"
        >
          {t("common.appName")}
        </Link>

        <nav
          aria-label={t("nav.main")}
          className="mt-6 flex flex-1 flex-col gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <NavIcon name={item.icon} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4">
          <SettingsControls />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 pb-24 md:pb-8">{children}</div>
      </div>

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 text-[0.7rem] font-medium ${
                    active
                      ? "border-accent text-accent"
                      : "border-transparent text-muted"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
