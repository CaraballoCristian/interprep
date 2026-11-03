"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { DeckSummary } from "@lib/decks/types";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { toggleSideField } from "@lib/study/config";
import type { StudyConfig } from "@lib/study/types";
import {
  CARD_STATUSES,
  SIDE_FIELDS,
  type CardStatus,
  type SideField,
} from "@lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeading } from "@/components/page-heading";
import { useI18n } from "@/components/settings-provider";

const FIELD_KEYS: Record<SideField, TranslationKey> = {
  termEng: "field.termEng",
  termEsp: "field.termEsp",
  description: "field.description",
};

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  easy: "status.easy",
  hard: "status.hard",
  learned: "status.learned",
};

type TemplateView = {
  id: string;
  name: string;
  config: StudyConfig;
  createdAt: string;
  updatedAt: string;
};

type FiltersView = {
  config: StudyConfig;
  templateId: string | null;
  categories: string[];
  categoriesByDeck: Record<string, string[]>;
  decks: DeckSummary[];
  templates: TemplateView[];
  cardCount: number;
  deckCount: number;
  sessionActive: boolean;
};

type ConfirmState =
  | { kind: "apply" }
  | { kind: "overwrite"; template: TemplateView }
  | { kind: "delete-template"; template: TemplateView }
  | { kind: "delete-deck"; deck: DeckSummary }
  | null;

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function categoryLabel(category: string, t: Translate): string {
  return category === "" ? t("filters.uncategorized") : category;
}

/** Union of the categories present in the selected decks. */
function categoriesForDecks(
  deckIds: readonly string[] | null,
  categoriesByDeck: Readonly<Record<string, string[]>>,
  allDeckIds: readonly string[],
): string[] {
  const selected = deckIds === null ? allDeckIds : deckIds;
  const categories = new Set<string>();

  for (const deckId of selected) {
    for (const category of categoriesByDeck[deckId] ?? []) {
      categories.add(category);
    }
  }

  return [...categories].sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Drops categories that are no longer available. When every available
 * category is selected the config goes back to `null` ("all").
 */
function pruneCategories(
  categories: string[] | null,
  available: readonly string[],
): string[] | null {
  if (categories === null) {
    return null;
  }

  const next = categories.filter((category) => available.includes(category));
  if (available.length > 0 && next.length === available.length) {
    return null;
  }

  return next;
}

function deckSummary(
  deckIds: string[] | null,
  deckCount: number,
  t: Translate,
): string {
  if (deckIds === null) {
    return deckCount > 0
      ? t("deck.summaryAll", { count: deckCount })
      : t("deck.summaryAllPlain");
  }

  if (deckIds.length === 0) {
    return t("deck.summaryNone");
  }

  return t("deck.summaryCount", {
    selected: deckIds.length,
    total: deckCount,
  });
}

function decksLabel(
  deckIds: string[] | null,
  decks: readonly DeckSummary[],
  t: Translate,
): string {
  if (deckIds === null) {
    return t("deck.summaryAllPlain");
  }

  if (deckIds.length === 0) {
    return t("deck.summaryNone");
  }

  const names = new Map(decks.map((deck) => [deck.id, deck.name]));
  return deckIds
    .map((id) => names.get(id) ?? t("deck.error.notFound"))
    .join(", ");
}

function sideLabel(side: SideField[], t: Translate): string {
  return side.map((field) => t(FIELD_KEYS[field])).join(" + ") || "—";
}

function categoriesLabel(config: StudyConfig, t: Translate): string {
  if (config.categories === null) {
    return t("filters.categoriesAllLabel");
  }
  if (config.categories.length === 0) {
    return t("filters.categoriesNoneLabel");
  }
  return config.categories.map((category) => categoryLabel(category, t)).join(", ");
}

function statusesLabel(statuses: CardStatus[], t: Translate): string {
  if (statuses.length === 0) {
    return t("filters.statusesNoneLabel");
  }
  return statuses.map((status) => t(STATUS_KEYS[status])).join(", ");
}

export default function FiltersPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<FiltersView | null>(null);
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deckName, setDeckName] = useState("");
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [editingDeckName, setEditingDeckName] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmState>(null);

  const readError = useCallback(
    (body: unknown): string => {
      const code =
        typeof body === "object" && body !== null && "error" in body
          ? (body as { error?: string }).error
          : undefined;

      switch (code) {
        case "invalid_config":
          return t("filters.error.invalidConfig");
        case "invalid_name":
          return t("filters.error.invalidName");
        case "duplicate_name":
          return t("filters.error.duplicateName");
        case "empty_update":
          return t("filters.error.emptyUpdate");
        case "last_deck":
          return t("deck.error.last");
        case "not_found":
          return t("filters.error.notFound");
        case "invalid_input":
          return t("filters.error.invalidInput");
        default:
          return t("filters.error.generic");
      }
    },
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const body = await readJson(response);
        if (!response.ok) {
          throw new Error(readError(body));
        }

        const view = body as FiltersView;
        if (!cancelled) {
          setData(view);
          setConfig(view.config);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : t("filters.loadError"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Load once: changing the language must not discard unsaved filter edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMeta = useCallback(async (): Promise<FiltersView> => {
    const response = await fetch("/api/session", { cache: "no-store" });
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(readError(body));
    }
    const view = body as FiltersView;
    setData(view);
    return view;
  }, [readError]);

  const allDeckIds = data?.decks.map((deck) => deck.id) ?? [];
  const availableCategories = categoriesForDecks(
    config?.deckIds ?? null,
    data?.categoriesByDeck ?? {},
    allDeckIds,
  );

  async function run(action: () => Promise<void>) {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("filters.error.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleSide(side: "sideA" | "sideB", field: SideField) {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      return toggleSideField(current, side, field);
    });
  }

  function toggleStatus(status: CardStatus) {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      const selected = current.statuses.includes(status);
      return {
        ...current,
        statuses: selected
          ? current.statuses.filter((item) => item !== status)
          : [...current.statuses, status],
      };
    });
  }

  function selectAllStatuses() {
    setConfig((current) =>
      current ? { ...current, statuses: [...CARD_STATUSES] } : current,
    );
  }

  function selectNoStatuses() {
    setConfig((current) => (current ? { ...current, statuses: [] } : current));
  }

  function toggleContinuous() {
    setConfig((current) =>
      current ? { ...current, continuous: !current.continuous } : current,
    );
  }

  function toggleCategory(category: string) {
    const all = availableCategories;

    setConfig((current) => {
      if (!current) {
        return current;
      }

      const selected = new Set(
        current.categories === null ? all : current.categories,
      );

      if (selected.has(category)) {
        selected.delete(category);
      } else {
        selected.add(category);
      }

      if (all.length > 0 && selected.size === all.length) {
        return { ...current, categories: null };
      }

      return {
        ...current,
        categories: all.filter((item) => selected.has(item)),
      };
    });
  }

  function selectAllCategories() {
    setConfig((current) =>
      current ? { ...current, categories: null } : current,
    );
  }

  function selectNoCategories() {
    setConfig((current) => (current ? { ...current, categories: [] } : current));
  }

  function toggleDeck(deckId: string) {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      const selected = new Set(
        current.deckIds === null ? allDeckIds : current.deckIds,
      );

      if (selected.has(deckId)) {
        selected.delete(deckId);
      } else {
        selected.add(deckId);
      }

      const deckIds =
        allDeckIds.length > 0 && selected.size === allDeckIds.length
          ? null
          : allDeckIds.filter((id) => selected.has(id));
      const available = categoriesForDecks(
        deckIds,
        data?.categoriesByDeck ?? {},
        allDeckIds,
      );

      return {
        ...current,
        deckIds,
        categories: pruneCategories(current.categories, available),
      };
    });
  }

  function selectAllDecks() {
    setConfig((current) => {
      if (!current) {
        return current;
      }

      const available = categoriesForDecks(
        null,
        data?.categoriesByDeck ?? {},
        allDeckIds,
      );

      return {
        ...current,
        deckIds: null,
        categories: pruneCategories(current.categories, available),
      };
    });
  }

  function selectNoDecks() {
    setConfig((current) =>
      current ? { ...current, deckIds: [], categories: [] } : current,
    );
  }

  function applyConfig() {
    if (!config) {
      return;
    }

    if (data?.sessionActive) {
      setPendingConfirm({ kind: "apply" });
      return;
    }

    runApply();
  }

  function runApply() {
    if (!config) {
      return;
    }

    const current = config;

    void run(async () => {
      const response = await fetch("/api/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: current }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      router.push("/");
    });
  }

  function saveAsTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config) {
      return;
    }

    void run(async () => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, config }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      setTemplateName("");
      setNotice(t("filters.notice.saved"));
      await refreshMeta();
    });
  }

  function applyTemplate(id: string) {
    void run(async () => {
      const response = await fetch(`/api/templates/${id}/apply`, {
        method: "POST",
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      router.push("/");
    });
  }

  function startRename(template: TemplateView) {
    setEditingId(template.id);
    setEditingName(template.name);
    setError(null);
    setNotice(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditingName("");
  }

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    void run(async () => {
      const response = await fetch(`/api/templates/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      cancelRename();
      setNotice(t("filters.notice.renamed"));
      await refreshMeta();
    });
  }

  function overwriteTemplate(template: TemplateView) {
    if (!config) {
      return;
    }

    setPendingConfirm({ kind: "overwrite", template });
  }

  function runOverwriteTemplate(template: TemplateView) {
    if (!config) {
      return;
    }

    const current = config;

    void run(async () => {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: current }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      setNotice(t("filters.notice.overwritten"));
      await refreshMeta();
    });
  }

  function deleteTemplate(template: TemplateView) {
    setPendingConfirm({ kind: "delete-template", template });
  }

  function runDeleteTemplate(template: TemplateView) {
    void run(async () => {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "DELETE",
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      if (editingId === template.id) {
        cancelRename();
      }
      setNotice(t("filters.notice.deleted"));
      await refreshMeta();
    });
  }

  function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deckName.trim() === "") {
      return;
    }

    void run(async () => {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      setDeckName("");
      setNotice(t("deck.notice.created"));
      await refreshMeta();
    });
  }

  function startDeckRename(deck: DeckSummary) {
    setEditingDeckId(deck.id);
    setEditingDeckName(deck.name);
    setError(null);
    setNotice(null);
  }

  function cancelDeckRename() {
    setEditingDeckId(null);
    setEditingDeckName("");
  }

  function submitDeckRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDeckId || editingDeckName.trim() === "") {
      return;
    }

    const id = editingDeckId;

    void run(async () => {
      const response = await fetch(`/api/decks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingDeckName }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      cancelDeckRename();
      setNotice(t("deck.notice.renamed"));
      await refreshMeta();
    });
  }

  function requestDeleteDeck(deck: DeckSummary) {
    setPendingConfirm({ kind: "delete-deck", deck });
  }

  function runDeleteDeck(deck: DeckSummary) {
    void run(async () => {
      const response = await fetch(`/api/decks/${deck.id}`, {
        method: "DELETE",
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      if (editingDeckId === deck.id) {
        cancelDeckRename();
      }

      const view = await refreshMeta();
      const remainingIds = view.decks.map((item) => item.id);

      setConfig((current) => {
        if (!current) {
          return current;
        }

        const deckIds =
          current.deckIds === null
            ? null
            : current.deckIds.filter((id) => remainingIds.includes(id));
        const available = categoriesForDecks(
          deckIds,
          view.categoriesByDeck,
          remainingIds,
        );

        return {
          ...current,
          deckIds,
          categories: pruneCategories(current.categories, available),
        };
      });

      setNotice(t("deck.notice.deleted"));
    });
  }

  function confirmPending() {
    const pending = pendingConfirm;
    setPendingConfirm(null);

    if (!pending) {
      return;
    }

    switch (pending.kind) {
      case "apply":
        runApply();
        break;
      case "overwrite":
        runOverwriteTemplate(pending.template);
        break;
      case "delete-template":
        runDeleteTemplate(pending.template);
        break;
      case "delete-deck":
        runDeleteDeck(pending.deck);
        break;
    }
  }

  if (loading && !data) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">{t("filters.loading")}</p>
      </main>
    );
  }

  if (!data || !config) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert" className="text-sm text-danger">
          {error ?? t("filters.loadError")}
        </p>
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-xl border border-border px-5 text-sm font-medium"
        >
          {t("common.study")}
        </Link>
      </main>
    );
  }

  const categoriesAll = availableCategories;
  const selectedCategories =
    config.categories === null
      ? new Set(categoriesAll)
      : new Set(config.categories);

  const sidesValid = config.sideA.length > 0 && config.sideB.length > 0;
  const overlap = config.sideA.some((field) => config.sideB.includes(field));
  const canApply = sidesValid && !overlap && !busy;
  const canSave = canApply && templateName.trim() !== "";

  const categorySummary =
    config.categories === null
      ? categoriesAll.length > 0
        ? t("filters.categorySummaryAll", { count: categoriesAll.length })
        : t("filters.categorySummaryAllPlain")
      : config.categories.length === 0
        ? t("filters.categorySummaryNone")
        : t("filters.categorySummaryCount", {
            selected: config.categories.length,
            total: categoriesAll.length,
          });

  const currentDeckSummary = deckSummary(
    config.deckIds,
    data.decks.length,
    t,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading title={t("filters.title")} />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("filters.sidesTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("filters.sidesDescription")}
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <span>{t("filters.field")}</span>
              <span className="text-center">{t("filters.sideA")}</span>
              <span className="text-center">{t("filters.sideB")}</span>
            </div>

            {SIDE_FIELDS.map((field) => {
              const inA = config.sideA.includes(field);
              const inB = config.sideB.includes(field);
              const fieldLabel = t(FIELD_KEYS[field]);

              return (
                <div
                  key={field}
                  className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2"
                >
                  <span className="text-sm">{fieldLabel}</span>

                  <label
                    className={`flex min-h-12 items-center justify-center rounded-xl border ${
                      inA
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background"
                    } ${busy ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={inA}
                      disabled={busy}
                      aria-label={t("filters.sideLabelA", {
                        field: fieldLabel,
                      })}
                      onChange={() => toggleSide("sideA", field)}
                    />
                    <span className="sr-only">
                      {t("filters.sideLabelA", { field: fieldLabel })}
                    </span>
                  </label>

                  <label
                    className={`flex min-h-12 items-center justify-center rounded-xl border ${
                      inB
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background"
                    } ${busy ? "opacity-60" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={inB}
                      disabled={busy}
                      aria-label={t("filters.sideLabelB", {
                        field: fieldLabel,
                      })}
                      onChange={() => toggleSide("sideB", field)}
                    />
                    <span className="sr-only">
                      {t("filters.sideLabelB", { field: fieldLabel })}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {!sidesValid && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              {t("filters.sidesInvalid")}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{t("deck.title")}</h2>
            <span className="text-xs text-muted">{currentDeckSummary}</span>
          </div>
          <p className="text-sm text-muted">{t("filters.decksDescription")}</p>

          <details className="rounded-xl border border-border bg-background">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-muted">
                  ▾
                </span>
                {t("deck.choose")}
              </span>
              <span className="text-xs font-normal text-muted">
                {currentDeckSummary}
              </span>
            </summary>

            <div className="space-y-2 border-t border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={selectAllDecks}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
                >
                  {t("filters.all")}
                </button>
                <button
                  type="button"
                  onClick={selectNoDecks}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
                >
                  {t("filters.none")}
                </button>
              </div>

              {data.decks.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted">
                  {t("deck.empty")}
                </p>
              ) : (
                <div className="space-y-1">
                  {data.decks.map((deck) => {
                    const checked =
                      config.deckIds === null ||
                      config.deckIds.includes(deck.id);

                    return (
                      <label
                        key={deck.id}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleDeck(deck.id)}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {deck.name}
                        </span>
                        <span className="text-xs text-muted">
                          {t(
                            deck.cardCount === 1
                              ? "deck.cardsOne"
                              : "deck.cards",
                            { count: deck.cardCount },
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t("filters.categoriesTitle")}
            </h2>
            <span className="text-xs text-muted">{categorySummary}</span>
          </div>

          <details className="rounded-xl border border-border bg-background">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-muted">
                  ▾
                </span>
                {t("filters.chooseCategories")}
              </span>
              <span className="text-xs font-normal text-muted">
                {categorySummary}
              </span>
            </summary>

            <div className="space-y-2 border-t border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={selectAllCategories}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
                >
                  {t("filters.all")}
                </button>
                <button
                  type="button"
                  onClick={selectNoCategories}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
                >
                  {t("filters.none")}
                </button>
              </div>

              {categoriesAll.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted">
                  {t("filters.noCategories")}
                </p>
              ) : (
                <div className="space-y-1">
                  {categoriesAll.map((category) => {
                    const checked = selectedCategories.has(category);

                    return (
                      <label
                        key={category || "__empty"}
                        className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          checked={checked}
                          disabled={busy}
                          onChange={() => toggleCategory(category)}
                        />
                        <span className="text-sm">
                          {categoryLabel(category, t)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">
            {t("filters.statusesTitle")}
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAllStatuses}
              disabled={busy}
              className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
            >
              {t("filters.all")}
            </button>
            <button
              type="button"
              onClick={selectNoStatuses}
              disabled={busy}
              className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
            >
              {t("filters.none")}
            </button>
          </div>

          <div className="space-y-1">
            {CARD_STATUSES.map((status) => {
              const checked = config.statuses.includes(status);

              return (
                <label
                  key={status}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggleStatus(status)}
                  />
                  <span className="text-sm">{t(STATUS_KEYS[status])}</span>
                </label>
              );
            })}
          </div>

          {config.statuses.length === 0 && (
            <p className="text-sm text-muted">{t("filters.statusesEmpty")}</p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">
              {t("filters.continuousTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("filters.continuousDescription")}
            </p>
          </div>

          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-background px-3">
            <span className="text-sm font-medium">
              {t("filters.continuousLabel")}
            </span>
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={config.continuous}
              disabled={busy}
              onChange={toggleContinuous}
            />
          </label>
        </section>

        {data.sessionActive && (
          <p className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
            {t("filters.sessionActive")}
          </p>
        )}

        <button
          type="button"
          onClick={applyConfig}
          disabled={!canApply}
          className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
        >
          {t("filters.apply")}
        </button>
        <p className="text-center text-xs text-muted">
          {t("filters.applyNote")}
        </p>
        </div>

        <div className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("deck.manageTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("deck.manageDescription")}
            </p>
          </div>

          <form onSubmit={createDeck} className="space-y-2">
            <label htmlFor="deck-name" className="sr-only">
              {t("deck.nameLabel")}
            </label>
            <input
              id="deck-name"
              value={deckName}
              onChange={(event) => setDeckName(event.target.value)}
              maxLength={80}
              placeholder={t("deck.namePlaceholder")}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || deckName.trim() === ""}
              className="min-h-12 w-full rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50"
            >
              {t("deck.create")}
            </button>
          </form>

          {data.decks.length === 0 ? (
            <p className="text-sm text-muted">{t("deck.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {data.decks.map((deck) => (
                <li
                  key={deck.id}
                  className="space-y-2 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {deck.name}
                      </p>
                      <p className="text-xs text-muted">
                        {t(
                          deck.cardCount === 1 ? "deck.cardsOne" : "deck.cards",
                          { count: deck.cardCount },
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startDeckRename(deck)}
                        disabled={busy}
                        className="min-h-12 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
                      >
                        {t("deck.rename")}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteDeck(deck)}
                        disabled={busy || data.decks.length <= 1}
                        title={
                          data.decks.length <= 1
                            ? t("deck.error.last")
                            : undefined
                        }
                        className="min-h-12 rounded-xl border border-danger/40 px-3 text-sm font-medium text-danger disabled:opacity-50"
                      >
                        {t("deck.delete")}
                      </button>
                    </div>
                  </div>

                  {editingDeckId === deck.id && (
                    <form onSubmit={submitDeckRename} className="space-y-2">
                      <label
                        htmlFor={`deck-rename-${deck.id}`}
                        className="block text-sm font-medium"
                      >
                        {t("deck.nameLabel")}
                      </label>
                      <input
                        id={`deck-rename-${deck.id}`}
                        value={editingDeckName}
                        onChange={(event) =>
                          setEditingDeckName(event.target.value)
                        }
                        maxLength={80}
                        autoFocus
                        className="min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy || editingDeckName.trim() === ""}
                          className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                        >
                          {t("deck.saveName")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelDeckRename}
                          disabled={busy}
                          className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("filters.saveTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("filters.saveDescription")}
            </p>
          </div>

          <form onSubmit={saveAsTemplate} className="space-y-2">
            <label htmlFor="template-name" className="sr-only">
              {t("filters.saveNameLabel")}
            </label>
            <input
              id="template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              maxLength={80}
              placeholder={t("filters.savePlaceholder")}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-12 w-full rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50"
            >
              {t("filters.saveButton")}
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t("filters.templatesTitle")}
            </h2>
            <span className="text-xs text-muted">
              {data.templates.length}
            </span>
          </div>

          {data.templates.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              {t("filters.noTemplates")}
            </p>
          ) : (
            <ul className="space-y-3">
              {data.templates.map((template) => (
                <li
                  key={template.id}
                  className="space-y-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{template.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        A: {sideLabel(template.config.sideA, t)} → B:{" "}
                        {sideLabel(template.config.sideB, t)}
                      </p>
                    </div>

                    {data.templateId === template.id && (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        {t("filters.applied")}
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted">{t("filters.categories")}</dt>
                    <dd>{categoriesLabel(template.config, t)}</dd>
                    <dt className="text-muted">{t("deck.title")}</dt>
                    <dd>{decksLabel(template.config.deckIds, data.decks, t)}</dd>
                    <dt className="text-muted">{t("filters.statuses")}</dt>
                    <dd>{statusesLabel(template.config.statuses, t)}</dd>
                    {template.config.continuous && (
                      <>
                        <dt className="text-muted">
                          {t("filters.continuousTitle")}
                        </dt>
                        <dd>{t("filters.continuousShort")}</dd>
                      </>
                    )}
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      disabled={busy}
                      className="min-h-12 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                    >
                      {t("filters.applyTemplate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                    >
                      {t("filters.rename")}
                    </button>
                    <button
                      type="button"
                      onClick={() => overwriteTemplate(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                    >
                      {t("filters.overwrite")}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-danger/40 px-4 text-sm font-medium text-danger disabled:opacity-50"
                    >
                      {t("filters.delete")}
                    </button>
                  </div>

                  {editingId === template.id && (
                    <form
                      onSubmit={submitRename}
                      className="space-y-2 rounded-xl border border-border bg-background p-3"
                    >
                      <label
                        htmlFor={`rename-${template.id}`}
                        className="block text-sm font-medium"
                      >
                        {t("filters.newName")}
                      </label>
                      <input
                        id={`rename-${template.id}`}
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        maxLength={80}
                        autoFocus
                        className="min-h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy || editingName.trim() === ""}
                          className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                        >
                          {t("common.save")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={busy}
                          className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>

      <ConfirmDialog
        open={pendingConfirm !== null}
        title={
          pendingConfirm === null
            ? ""
            : pendingConfirm.kind === "apply"
              ? t("filters.confirm.applyTitle")
              : pendingConfirm.kind === "overwrite"
                ? t("filters.confirm.overwriteTitle")
                : pendingConfirm.kind === "delete-template"
                  ? t("filters.confirm.deleteTitle")
                  : t("deck.confirmDeleteTitle")
        }
        description={
          pendingConfirm === null
            ? undefined
            : pendingConfirm.kind === "apply"
              ? t("filters.confirm.applyWithSession")
              : pendingConfirm.kind === "overwrite"
                ? t("filters.confirm.overwrite", {
                    name: pendingConfirm.template.name,
                  })
                : pendingConfirm.kind === "delete-template"
                  ? t("filters.confirm.delete", {
                      name: pendingConfirm.template.name,
                    })
                  : t("deck.confirmDelete", {
                      name: pendingConfirm.deck.name,
                      count: pendingConfirm.deck.cardCount,
                    })
        }
        confirmLabel={
          pendingConfirm === null
            ? ""
            : pendingConfirm.kind === "apply"
              ? t("filters.apply")
              : pendingConfirm.kind === "overwrite"
                ? t("filters.overwrite")
                : pendingConfirm.kind === "delete-template"
                  ? t("filters.delete")
                  : t("deck.delete")
        }
        tone={
          pendingConfirm !== null &&
          (pendingConfirm.kind === "delete-template" ||
            pendingConfirm.kind === "delete-deck")
            ? "danger"
            : "default"
        }
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPendingConfirm(null)}
      />
    </main>
  );
}
