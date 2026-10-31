"use client";

import Link from "next/link";
import { SettingsControls } from "./settings-controls";

type HeaderLink = {
  href: string;
  label: string;
};

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  links?: HeaderLink[];
};

/**
 * Shared page header: app name, title, optional subtitle, the theme/language
 * controls and the page navigation. It wraps at 360px instead of overflowing.
 */
export function PageHeader({ title, subtitle, links = [] }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Interprep
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SettingsControls />
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-12 items-center rounded-xl border border-border px-3 text-sm font-medium"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
