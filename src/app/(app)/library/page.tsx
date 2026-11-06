"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  withFastMode,
  type HiddenFilter,
  type LibraryFilter,
} from "@lib/library/filter";
import type { LibraryCard } from "@lib/library/types";
import type { DeckSummary } from "@lib/decks/types";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { CARD_STATUSES, type CardResult, type CardStatus } from "@lib/types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeading } from "@/components/page-heading";
import { SpeakButton } from "@/components/speech/speak-button";
import { useI18n } from "@/components/settings-provider";

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  easy: "status.easy",
  hard: "status.hard",
  learned: "status.learned",
};

const HIDDEN_OPTIONS: { value: HiddenFilter; key: TranslationKey }[] = [
  { value: "all", key: "library.visibleAll" },
  { value: "visible", key: "library.visibleOnly" },
  { value: "hidden", key: "library.hiddenOnly" },
];

const ALL_CATEGORIES = "__all__";
const ALL_DECKS = "__all_decks__";

type LibraryResponse = {
  filter: LibraryFilter;
  cards: LibraryCard[];
  categories: string[];
  decks: DeckSummary[];
  total: number;
  visible: number;
  hidden: number;
  filtered: number;
};

type CardDraft = {
  deckId: string;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
};

const EMPTY_DRAFT: CardDraft = {
  deckId: "",
  termEng: "",
  termEsp: "",
  category: "",
  description: "",
  status: "new",
};

type Translate = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function categoryLabel(category: string, t: Translate): string {
  return category === "" ? t("library.uncategorized") : category;
}

function historyText(history: CardResult[], t: Translate): string {
  if (history.length === 0) {
    return t("library.noHistory");
  }

  const shown = history.slice(-12);
  const prefix = history.length > shown.length ? "… " : "";
  return (
    prefix +
    shown.map((result) => (result === "s" ? "✓" : "✕")).join(" ")
  );
}

type CardFieldsProps = {
  idPrefix: string;
  draft: CardDraft;
  categories: string[];
  decks: DeckSummary[];
  disabled: boolean;
  onChange: (patch: Partial<CardDraft>) => void;
};

function CardFields({
  idPrefix,
  draft,
  categories,
  decks,
  disabled,
  onChange,
}: CardFieldsProps) {
  const { t } = useI18n();
  const inputClass =
    "min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent disabled:opacity-60";

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={`${idPrefix}-term-eng`}
          className="mb-1 block text-sm font-medium"
        >
          {t("field.termEng")}
        </label>
        <input
          id={`${idPrefix}-term-eng`}
          value={draft.termEng}
          onChange={(event) => onChange({ termEng: event.target.value })}
          maxLength={300}
          autoComplete="off"
          disabled={disabled}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-term-esp`}
          className="mb-1 block text-sm font-medium"
        >
          {t("field.termEsp")}
        </label>
        <input
          id={`${idPrefix}-term-esp`}
          value={draft.termEsp}
          onChange={(event) => onChange({ termEsp: event.target.value })}
          maxLength={300}
          autoComplete="off"
          disabled={disabled}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-deck`}
          className="mb-1 block text-sm font-medium"
        >
          {t("deck.label")}
        </label>
        <select
          id={`${idPrefix}-deck`}
          value={draft.deckId}
          onChange={(event) => onChange({ deckId: event.target.value })}
          disabled={disabled || decks.length === 0}
          className={inputClass}
        >
          {decks.map((deck) => (
            <option key={deck.id} value={deck.id}>
              {deck.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`${idPrefix}-category`}
            className="mb-1 block text-sm font-medium"
          >
            {t("field.category")}
          </label>
          <input
            id={`${idPrefix}-category`}
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value })}
            list={`${idPrefix}-categories`}
            maxLength={120}
            autoComplete="off"
            disabled={disabled}
            className={inputClass}
          />
          <datalist id={`${idPrefix}-categories`}>
            {categories
              .filter((category) => category !== "")
              .map((category) => (
                <option key={category} value={category} />
              ))}
          </datalist>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-status`}
            className="mb-1 block text-sm font-medium"
          >
            {t("field.status")}
          </label>
          <select
            id={`${idPrefix}-status`}
            value={draft.status}
            onChange={(event) =>
              onChange({ status: event.target.value as CardStatus })
            }
            disabled={disabled}
            className={inputClass}
          >
            {CARD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(STATUS_KEYS[status])}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-description`}
          className="mb-1 block text-sm font-medium"
        >
          {t("field.description")}
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
          maxLength={4000}
          disabled={disabled}
          className={`${inputClass} py-3`}
        />
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const { t } = useI18n();
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [deckId, setDeckId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<CardStatus | null>(null);
  const [hidden, setHidden] = useState<HiddenFilter>("all");
  const [fastMode, setFastMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CardDraft>(EMPTY_DRAFT);
  const [pendingDelete, setPendingDelete] = useState<LibraryCard | null>(null);

  function readError(body: unknown): string {
    const code =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error?: string }).error
        : undefined;

    switch (code) {
      case "terms_required":
        return t("library.error.termsRequired");
      case "duplicate_card":
        return t("library.error.duplicate");
      case "deck_not_found":
        return t("deck.error.notFound");
      case "invalid_status":
        return t("library.error.invalidStatus");
      case "invalid_hidden":
        return t("library.error.invalidHidden");
      case "empty_update":
        return t("library.error.emptyUpdate");
      case "not_found":
        return t("library.error.notFound");
      case "invalid_input":
        return t("library.error.invalidInput");
      case "invalid_json":
        return t("library.error.invalidJson");
      default:
        return t("library.error.generic");
    }
  }

  const requestFilter = useMemo(
    () =>
      withFastMode(
        { search, deckId, category, status, hidden },
        fastMode,
      ),
    [search, deckId, category, status, hidden, fastMode],
  );

  useEffect(() => {
    if (fastMode) {
      searchRef.current?.focus();
    }
  }, [fastMode]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (requestFilter.search.trim() !== "") {
        params.set("search", requestFilter.search.trim());
      }
      if (requestFilter.deckId !== null) {
        params.set("deck", requestFilter.deckId);
      }
      if (requestFilter.category !== null) {
        params.set("category", requestFilter.category);
      }
      if (requestFilter.status !== null) {
        params.set("status", requestFilter.status);
      }
      params.set("hidden", requestFilter.hidden);

      setLoading(true);

      fetch(`/api/cards?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = await readJson(response);
          if (!response.ok) {
            throw new Error(readError(body));
          }
          setData(body as LibraryResponse);
          const view = body as LibraryResponse;
          setCategory((current) =>
            current !== null && !view.categories.includes(current)
              ? null
              : current,
          );
          setError(null);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) {
            return;
          }
          setError(
            cause instanceof Error ? cause.message : t("library.loadError"),
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, fastMode ? 100 : 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestFilter, fastMode, refreshKey]);

  const refresh = () => setRefreshKey((key) => key + 1);

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
        cause instanceof Error ? cause.message : t("library.error.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setDeckId(null);
    setCategory(null);
    setStatus(null);
    setHidden("all");
  }

  function startCreate() {
    setCreating(true);
    setCreateDraft({
      ...EMPTY_DRAFT,
      deckId: deckId ?? data?.decks[0]?.id ?? "",
    });
    setEditingId(null);
    setError(null);
    setNotice(null);
  }

  function cancelCreate() {
    setCreating(false);
    setCreateDraft(EMPTY_DRAFT);
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void run(async () => {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createDraft),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      cancelCreate();
      setNotice(t("library.notice.created"));
      refresh();
    });
  }

  function startEdit(card: LibraryCard) {
    setEditingId(card.id);
    setEditDraft({
      deckId: card.deckId,
      termEng: card.termEng,
      termEsp: card.termEsp,
      category: card.category,
      description: card.description,
      status: card.status,
    });
    setCreating(false);
    setError(null);
    setNotice(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(EMPTY_DRAFT);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }

    const id = editingId;

    void run(async () => {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      cancelEdit();
      setNotice(t("library.notice.saved"));
      refresh();
    });
  }

  function toggleHidden(card: LibraryCard) {
    void run(async () => {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !card.hidden }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      setNotice(
        card.hidden
          ? t("library.notice.restored")
          : t("library.notice.hidden"),
      );
      refresh();
    });
  }

  function requestRemoveCard(card: LibraryCard) {
    setPendingDelete(card);
  }

  function confirmRemoveCard() {
    const card = pendingDelete;
    if (!card) {
      return;
    }

    setPendingDelete(null);

    void run(async () => {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      if (editingId === card.id) {
        cancelEdit();
      }
      setNotice(t("library.notice.deleted"));
      refresh();
    });
  }

  const categories = data?.categories ?? [];
  const decks = data?.decks ?? [];

  const deckNames = useMemo(
    () => new Map(decks.map((deck) => [deck.id, deck.name])),
    [decks],
  );

  const categoryOptions = useMemo(() => {
    if (category !== null && !categories.includes(category)) {
      return [...categories, category];
    }
    return categories;
  }, [categories, category]);

  const hasFilters =
    search.trim() !== "" ||
    deckId !== null ||
    category !== null ||
    status !== null ||
    hidden !== "all";

  if (loading && !data) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4">
        <p className="text-sm text-muted">{t("library.loading")}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert" className="text-sm text-danger">
          {error ?? t("library.loadError")}
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

  const summary = t("library.summary", {
    filtered: data.filtered,
    total: data.total,
    cards: t(data.total === 1 ? "library.cardOne" : "library.cardMany"),
    hidden: data.hidden,
    hiddenWord: t(
      data.hidden === 1 ? "library.hiddenOne" : "library.hiddenMany",
    ),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading title={t("library.title")} subtitle={summary} />

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

      <div className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {t("library.searchTitle")}
            </h2>
            {!fastMode && hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                disabled={busy}
                className="min-h-12 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
              >
                {t("library.clearFilters")}
              </button>
            )}
          </div>

          <label
            className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 ${
              fastMode
                ? "border-accent bg-accent/10"
                : "border-border bg-background"
            }`}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {t("library.fastMode")}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {t("library.fastModeDescription")}
              </span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={fastMode}
              onChange={(event) => setFastMode(event.target.checked)}
            />
          </label>

          <div>
            <label
              htmlFor="library-search"
              className="mb-1 block text-sm font-medium"
            >
              {t("library.searchLabel")}
            </label>
            <input
              ref={searchRef}
              id="library-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("library.searchPlaceholder")}
              autoComplete="off"
              enterKeyHint="search"
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
            />
            {fastMode && (
              <p className="mt-1 text-xs text-muted">
                {t("library.fastModeActive")}
              </p>
            )}
          </div>

          {!fastMode && (
            <>
              <div>
                <label
                  htmlFor="library-deck"
                  className="mb-1 block text-sm font-medium"
                >
                  {t("library.deckLabel")}
                </label>
                <select
                  id="library-deck"
                  value={deckId === null ? ALL_DECKS : deckId}
                  onChange={(event) =>
                    setDeckId(
                      event.target.value === ALL_DECKS
                        ? null
                        : event.target.value,
                    )
                  }
                  className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
                >
                  <option value={ALL_DECKS}>{t("library.allDecks")}</option>
                  {decks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-category"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t("library.categoryLabel")}
                  </label>
                  <select
                    id="library-category"
                    value={category === null ? ALL_CATEGORIES : category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value === ALL_CATEGORIES
                          ? null
                          : event.target.value,
                      )
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
                  >
                    <option value={ALL_CATEGORIES}>
                      {t("library.allCategories")}
                    </option>
                    {categoryOptions.map((item) => (
                      <option key={item || "__empty"} value={item}>
                        {categoryLabel(item, t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="library-status"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t("library.statusLabel")}
                  </label>
                  <select
                    id="library-status"
                    value={status ?? ""}
                    onChange={(event) =>
                      setStatus(
                        event.target.value === ""
                          ? null
                          : (event.target.value as CardStatus),
                      )
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-accent"
                  >
                    <option value="">{t("library.allStatuses")}</option>
                    {CARD_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {t(STATUS_KEYS[item])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium">
                  {t("library.visibility")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {HIDDEN_OPTIONS.map((option) => {
                    const selected = hidden === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setHidden(option.value)}
                        className={`min-h-12 rounded-xl border text-sm font-medium ${
                          selected
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border bg-background"
                        }`}
                      >
                        {t(option.key)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {loading && (
            <p role="status" className="text-xs text-muted">
              {t("library.updating")}
            </p>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startCreate}
            disabled={busy || creating}
            className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
          >
            {t("library.newCard")}
          </button>
          <a
            href="/api/export?format=csv"
            download
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            {t("library.exportCsv")}
          </a>
          <a
            href="/api/export?format=json"
            download
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            {t("library.exportJson")}
          </a>
        </div>
        <p className="text-center text-xs text-muted">
          {t("library.exportNote")}
        </p>

        {creating && (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">
              {t("library.createTitle")}
            </h2>
            <form onSubmit={submitCreate} className="space-y-4">
              <CardFields
                idPrefix="create"
                draft={createDraft}
                categories={categories}
                decks={decks}
                disabled={busy}
                onChange={(patch) =>
                  setCreateDraft((current) => ({ ...current, ...patch }))
                }
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                >
                  {t("library.saveCard")}
                </button>
                <button
                  type="button"
                  onClick={cancelCreate}
                  disabled={busy}
                  className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </section>
        )}

        {data.total === 0 ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="font-semibold">{t("library.emptyTitle")}</p>
            <p className="text-sm text-muted">
              {t("library.emptyDescription")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href="/import"
                className="flex min-h-12 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground"
              >
                {t("library.importCards")}
              </Link>
              <button
                type="button"
                onClick={startCreate}
                className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium"
              >
                {t("library.createCard")}
              </button>
            </div>
          </section>
        ) : data.cards.length === 0 ? (
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-center">
            <p className="font-semibold">{t("library.noResultsTitle")}</p>
            <p className="text-sm text-muted">
              {t("library.noResultsDescription")}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-medium"
            >
              {t("library.clearFilters")}
            </button>
          </section>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {data.cards.map((card) => {
              const editing = editingId === card.id;

              return (
                <li
                  key={card.id}
                  className={`flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 ${
                    editing ? "min-h-[22rem]" : "h-[22rem] overflow-hidden"
                  }`}
                >
                  <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start gap-2">
                          <p
                            className="min-w-0 flex-1 line-clamp-2 break-words text-lg font-semibold"
                            title={card.termEng}
                          >
                            {card.termEng}
                          </p>
                          <SpeakButton text={card.termEng} language="en" />
                        </div>
                        <div className="flex items-start gap-2">
                          <p
                            className="min-w-0 flex-1 line-clamp-1 break-words text-sm text-muted"
                            title={card.termEsp}
                          >
                            {card.termEsp}
                          </p>
                          <SpeakButton text={card.termEsp} language="es" />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {deckNames.get(card.deckId) ?? t("deck.label")}
                        </span>
                        <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium">
                          {t(STATUS_KEYS[card.status])}
                        </span>
                        {card.hidden && (
                          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
                            {t("library.hiddenBadge")}
                          </span>
                        )}
                      </div>
                    </div>

                    {card.description !== "" && (
                      <p
                        className="line-clamp-3 whitespace-pre-wrap break-words text-sm"
                        title={card.description}
                      >
                        {card.description}
                      </p>
                    )}

                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-muted">{t("library.category")}</dt>
                      <dd className="truncate" title={categoryLabel(card.category, t)}>
                        {categoryLabel(card.category, t)}
                      </dd>
                      <dt className="text-muted">{t("library.history")}</dt>
                      <dd>
                        <span
                          title={card.history
                            .map((result) => (result === "s" ? "✓" : "✕"))
                            .join(" ")}
                        >
                          {historyText(card.history, t)}
                        </span>
                      </dd>
                      <dt className="text-muted">{t("library.counters")}</dt>
                      <dd>
                        <span className="text-success">
                          ✓ {card.totalSuccess}
                        </span>
                        <span className="mx-1 text-muted">·</span>
                        <span className="text-danger">
                          ✕ {card.totalFail}
                        </span>
                      </dd>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(card)}
                      disabled={busy}
                      className="min-h-12 flex-1 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
                    >
                      {editing ? t("library.editing") : t("library.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(card)}
                      disabled={busy}
                      className="min-h-12 flex-1 rounded-xl border border-border px-3 text-sm font-medium disabled:opacity-50"
                    >
                      {card.hidden ? t("library.show") : t("library.hide")}
                    </button>
                    <button
                      type="button"
                      onClick={() => requestRemoveCard(card)}
                      disabled={busy}
                      className="min-h-12 flex-1 rounded-xl border border-danger/40 px-3 text-sm font-medium text-danger disabled:opacity-50"
                    >
                      {t("library.delete")}
                    </button>
                  </div>

                  {editing && (
                    <form
                      onSubmit={submitEdit}
                      className="space-y-4 rounded-xl border border-border bg-background p-3"
                    >
                      <CardFields
                        idPrefix={`edit-${card.id}`}
                        draft={editDraft}
                        categories={categories}
                        decks={decks}
                        disabled={busy}
                        onChange={(patch) =>
                          setEditDraft((current) => ({
                            ...current,
                            ...patch,
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="min-h-12 flex-1 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                        >
                          {t("library.saveChanges")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={busy}
                          className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("library.confirm.deleteTitle")}
        description={
          pendingDelete
            ? t("library.confirm.delete", {
                termEng: pendingDelete.termEng,
                termEsp: pendingDelete.termEsp,
              })
            : undefined
        }
        confirmLabel={t("library.delete")}
        tone="danger"
        onConfirm={confirmRemoveCard}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
