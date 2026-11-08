"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { DeckSummary } from "@lib/decks/types";
import type {
  ImportCommitResponse,
  ImportPreviewResponse,
} from "@lib/import/api-types";
import {
  IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
} from "@lib/import/headers";
import type { ImportErrorReason } from "@lib/import/preview";
import type {
  ImportUndoResponse,
  ImportUndoSummary,
} from "@lib/import/undo";
import type { TranslationKey } from "@lib/i18n/dictionary";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeading } from "@/components/page-heading";
import { useI18n } from "@/components/settings-provider";

const FIELD_KEYS: Record<ImportField, TranslationKey> = {
  termEng: "field.termEng",
  termEsp: "field.termEsp",
  category: "field.category",
  description: "field.description",
};

const REQUIRED_FIELDS: readonly ImportField[] = ["termEng", "termEsp"];

const ERROR_KEYS: Record<ImportErrorReason, TranslationKey> = {
  missingTermEng: "import.error.missingTermEng",
  missingTermEsp: "import.error.missingTermEsp",
};

const DELIMITER_KEYS: Record<string, TranslationKey> = {
  ",": "import.delimiter.comma",
  "\t": "import.delimiter.tab",
  ";": "import.delimiter.semicolon",
  "|": "import.delimiter.pipe",
};

export default function ImportPage() {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [headerRowInput, setHeaderRowInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCommitResponse | null>(null);
  const [resultDeckName, setResultDeckName] = useState<string | null>(null);
  const [undo, setUndo] = useState<ImportUndoSummary | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [deckId, setDeckId] = useState("");
  const [deckName, setDeckName] = useState("");
  const [creatingDeck, setCreatingDeck] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDecks() {
      try {
        const response = await fetch("/api/decks", { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as {
          decks?: DeckSummary[];
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(deckError(body?.error));
        }

        if (cancelled) {
          return;
        }

        const list = body?.decks ?? [];
        setDecks(list);
        setDeckId((current) => current || list[0]?.id || "");
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("deck.error.generic"),
          );
        }
      } finally {
        if (!cancelled) {
          setDecksLoading(false);
        }
      }
    }

    void loadDecks();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/import/undo", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const body = (await response.json().catch(() => null)) as {
          undo?: ImportUndoSummary | null;
        } | null;

        if (!cancelled) {
          setUndo(body?.undo ?? null);
        }
      })
      .catch(() => {
        // The banner is optional; a failed lookup should not block importing.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function deckError(code: string | undefined): string {
    switch (code) {
      case "invalid_name":
        return t("deck.error.invalidName");
      case "duplicate_name":
        return t("deck.error.duplicateName");
      case "not_found":
        return t("deck.error.notFound");
      case "last_deck":
        return t("deck.error.last");
      default:
        return t("deck.error.generic");
    }
  }

  async function readError(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as { error?: string };
      switch (data.error) {
        case "invalid_mapping":
          return t("import.error.mapping");
        case "no_valid_rows":
          return t("import.error.noValidRows");
        case "invalid_input":
          return t("import.error.invalidInput");
        case "duplicate_name":
        case "invalid_name":
        case "not_found":
        case "last_deck":
          return deckError(data.error);
        default:
          return t("import.error.unexpected");
      }
    } catch {
      return t("import.error.unexpected");
    }
  }

  async function analyze(options?: {
    mapping?: ColumnMapping;
    headerRow?: number;
    deckId?: string;
  }) {
    if (!content.trim()) {
      setError(t("import.error.pasteFirst"));
      return;
    }

    const targetDeck = options?.deckId ?? deckId;
    if (targetDeck === "") {
      setError(t("deck.error.notFound"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setResult(null);

    const headerRow = options?.headerRow ?? preview?.headerRow;

    try {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          deckId: targetDeck,
          ...(options?.mapping ? { mapping: options.mapping } : {}),
          ...(headerRow ? { headerRow } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ImportPreviewResponse;
      setPreview(data);
      setMapping(data.mapping);
      setHeaderRowInput(String(data.headerRow));
    } catch (cause) {
      setPreview(null);
      setMapping(null);
      setError(
        cause instanceof Error ? cause.message : t("import.error.analyze"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!mapping || deckId === "") {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          deckId,
          mapping,
          ...(preview ? { headerRow: preview.headerRow } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ImportCommitResponse;
      setResultDeckName(
        decks.find((deck) => deck.id === deckId)?.name ?? null,
      );
      setResult(data);
      setUndo(data.undo ?? null);
      setPreview(null);
      setMapping(null);
      setHeaderRowInput("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("import.error.import"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setContent(text);
    setFileName(file.name);
    setPreview(null);
    setMapping(null);
    setHeaderRowInput("");
    setResult(null);
    setError(null);
    setNotice(null);
  }

  function reset() {
    setContent("");
    setFileName(null);
    setPreview(null);
    setMapping(null);
    setHeaderRowInput("");
    setResult(null);
    setResultDeckName(null);
    setError(null);
    setNotice(null);
  }

  function onDeckChange(value: string) {
    setDeckId(value);
    setResult(null);
    setResultDeckName(null);
    setError(null);
    setNotice(null);

    if (preview) {
      void analyze({
        deckId: value,
        ...(mapping ? { mapping } : {}),
        headerRow: preview.headerRow,
      });
    }
  }

  async function runUndo() {
    if (undoBusy) {
      return;
    }

    setUndoBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/import/undo", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as
        | (ImportUndoResponse & { error?: string })
        | null;

      if (!response.ok || !body || body.error !== undefined) {
        const code = body?.error;
        throw new Error(
          code === "undo_not_found"
            ? t("import.undo.notFound")
            : code === "undo_conflict"
              ? t("import.undo.conflict")
              : t("import.undo.error"),
        );
      }

      setUndo(null);
      setResult(null);
      setResultDeckName(null);
      setPreview(null);
      setMapping(null);
      setHeaderRowInput("");
      setConfirmUndo(false);
      setNotice(
        t("import.undo.success", {
          deleted: body.deleted,
          restored: body.restored,
        }),
      );
    } catch (cause) {
      setConfirmUndo(false);
      setError(
        cause instanceof Error ? cause.message : t("import.undo.error"),
      );
    } finally {
      setUndoBusy(false);
    }
  }

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deckName.trim() === "" || creatingDeck) {
      return;
    }

    setCreatingDeck(true);
    setError(null);

    try {
      const response = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deckName }),
      });
      const body = (await response.json().catch(() => null)) as {
        deck?: DeckSummary;
        error?: string;
      } | null;

      if (!response.ok || !body?.deck) {
        throw new Error(deckError(body?.error));
      }

      const created = body.deck;
      setDecks((current) => [...current, created]);
      setDeckName("");
      onDeckChange(created.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("deck.error.generic"),
      );
    } finally {
      setCreatingDeck(false);
    }
  }

  function onMappingChange(field: ImportField, value: string) {
    if (!mapping) {
      return;
    }

    const next: ColumnMapping = {
      ...mapping,
      [field]: value === "" ? null : Number(value),
    };
    setMapping(next);
    void analyze({ mapping: next });
  }

  const headerRowValue = Number(headerRowInput);
  const canReanalyze =
    Number.isInteger(headerRowValue) && headerRowValue >= 1 && !busy;

  const canCommit =
    !busy &&
    deckId !== "" &&
    preview !== null &&
    preview.plan !== null &&
    preview.plan.validRows > 0 &&
    preview.missingRequired.length === 0;

  const delimiterKey = preview ? DELIMITER_KEYS[preview.delimiter] : undefined;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading title={t("import.title")} />

      {notice && (
        <p
          role="status"
          className="mb-4 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm"
        >
          {notice}
        </p>
      )}

      {!result && undo && (
        <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t("import.undo.bannerTitle")}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {t("import.undo.bannerDescription", {
                inserted: undo.inserted,
                updated: undo.updated,
                name: undo.deckName,
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmUndo(true)}
            disabled={undoBusy}
            className="min-h-12 shrink-0 rounded-xl border border-danger/40 px-4 text-sm font-medium text-danger disabled:opacity-50"
          >
            {t("import.undo.button")}
          </button>
        </section>
      )}

      {result ? (
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("import.doneTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {resultDeckName
                ? t("import.doneDeck", { name: resultDeckName })
                : t("import.doneDescription")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={t("import.stat.new")}
              value={result.inserted}
              tone="success"
              icon="+"
            />
            <Stat label={t("import.stat.updated")} value={result.updated} />
            <Stat label={t("import.stat.unchanged")} value={result.unchanged} />
            <Stat label={t("import.stat.preserved")} value={result.preserved} />
          </div>

          {result.skippedErrors > 0 && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              {t("import.skipped", { count: result.skippedErrors })}
            </p>
          )}

          {result.duplicateRows > 0 && (
            <p className="text-sm text-muted">
              {t("import.duplicates", { count: result.duplicateRows })}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            >
              {t("import.importAnother")}
            </button>
            <Link
              href="/"
              className="flex min-h-12 items-center rounded-xl border border-border px-5 text-sm font-medium"
            >
              {t("common.study")}
            </Link>
            {undo && (
              <button
                type="button"
                onClick={() => setConfirmUndo(true)}
                disabled={undoBusy}
                className="min-h-12 rounded-xl border border-danger/40 px-5 text-sm font-medium text-danger disabled:opacity-50"
              >
                {t("import.undo.button")}
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div>
              <h2 className="text-lg font-semibold">
                {t("import.deckLabel")}
              </h2>
              <p className="mt-1 text-sm text-muted">{t("import.deckHint")}</p>
            </div>

            <label htmlFor="import-deck" className="sr-only">
              {t("import.deckLabel")}
            </label>
            <select
              id="import-deck"
              value={deckId}
              onChange={(event) => onDeckChange(event.target.value)}
              disabled={busy || decksLoading || decks.length === 0}
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent disabled:opacity-50"
            >
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>

            <form onSubmit={createDeck} className="flex flex-wrap gap-2">
              <label htmlFor="import-deck-name" className="sr-only">
                {t("deck.nameLabel")}
              </label>
              <input
                id="import-deck-name"
                value={deckName}
                onChange={(event) => setDeckName(event.target.value)}
                maxLength={80}
                placeholder={t("deck.namePlaceholder")}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={
                  creatingDeck || deckName.trim() === "" || decksLoading
                }
                className="min-h-12 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-50"
              >
                {t("deck.create")}
              </button>
            </form>
          </section>

          <section className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
            <label
              htmlFor="import-content"
              className="block text-sm font-medium"
            >
              {t("import.pasteLabel")}
            </label>
            <textarea
              id="import-content"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setPreview(null);
                setMapping(null);
                setHeaderRowInput("");
                setResult(null);
              }}
              rows={8}
              spellCheck={false}
              placeholder={
                "English,Spanish,Category,Description\nPolicy,Póliza,Insurance,Contract document"
              }
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm outline-none focus:border-accent"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-12 cursor-pointer items-center rounded-xl border border-border px-4 text-sm font-medium">
                {t("import.upload")}
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                  onChange={(event) => void onFile(event)}
                  className="sr-only"
                />
              </label>
              <span className="text-sm text-muted">
                {fileName ?? t("import.orPaste")}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void analyze()}
              disabled={busy || deckId === "" || content.trim() === ""}
              className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {busy && !preview ? t("import.analyzing") : t("import.analyze")}
            </button>
          </section>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
            >
              {error}
            </p>
          )}

          {preview && (
            <div className="mt-4 space-y-4">
              <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">
                    {t("import.columns")}
                  </h2>
                  <span className="text-xs text-muted">
                    {t("import.separator", {
                      value: delimiterKey
                        ? t(delimiterKey)
                        : (preview.delimiter ?? "—"),
                    })}
                  </span>
                </div>

                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <label htmlFor="header-row" className="block text-sm">
                      <span className="mb-1 block font-medium">
                        {t("import.headerRow")}
                      </span>
                      <input
                        id="header-row"
                        type="number"
                        min={1}
                        value={headerRowInput}
                        onChange={(event) =>
                          setHeaderRowInput(event.target.value)
                        }
                        disabled={busy}
                        className="min-h-12 w-24 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        void analyze({ headerRow: headerRowValue })
                      }
                      disabled={!canReanalyze}
                      className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                    >
                      {t("import.reanalyze")}
                    </button>
                    <p className="min-w-0 flex-1 text-xs text-muted">
                      {t("import.headerRowHint")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {IMPORT_FIELDS.map((field) => (
                    <label key={field} className="block text-sm">
                      <span className="mb-1 block font-medium">
                        {t(FIELD_KEYS[field])}
                        {REQUIRED_FIELDS.includes(field) && (
                          <span className="text-danger"> *</span>
                        )}
                      </span>
                      <select
                        value={mapping?.[field] ?? ""}
                        onChange={(event) =>
                          onMappingChange(field, event.target.value)
                        }
                        disabled={busy}
                        className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
                      >
                        <option value="">{t("import.unassigned")}</option>
                        {preview.headers.map((header, index) => (
                          <option key={`${field}-${index}`} value={index}>
                            {header ||
                              t("import.column", { index: index + 1 })}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {preview.missingRequired.length > 0 && (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
                    {t("import.missingRequired", {
                      fields: preview.missingRequired
                        .map((field) => t(FIELD_KEYS[field]))
                        .join(", "),
                    })}
                  </p>
                )}

                {preview.parseErrors.length > 0 && (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
                    {t("import.parseProblems", {
                      count: preview.parseErrors.length,
                    })}
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-semibold">
                  {t("import.summary")}
                </h2>

                <div className="grid grid-cols-3 gap-2">
                  <Stat
                    label={t("import.stat.valid")}
                    value={preview.counts.valid}
                    tone="success"
                    icon="✓"
                  />
                  <Stat
                    label={t("import.stat.error")}
                    value={preview.counts.error}
                    tone="danger"
                    icon="✕"
                  />
                  <Stat
                    label={t("import.stat.empty")}
                    value={preview.counts.empty}
                    icon="—"
                  />
                </div>

                {preview.plan && preview.existingCards > 0 ? (
                  <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
                    <p className="text-sm">
                      {t("import.existing", { count: preview.existingCards })}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat
                        label={t("import.stat.new")}
                        value={preview.plan.inserts}
                      />
                      <Stat
                        label={t("import.stat.updated")}
                        value={preview.plan.updates}
                      />
                      <Stat
                        label={t("import.stat.unchanged")}
                        value={preview.plan.unchanged}
                      />
                      <Stat
                        label={t("import.stat.preserved")}
                        value={preview.plan.preserved}
                      />
                    </div>
                    {preview.plan.duplicateRows > 0 && (
                      <p className="text-sm text-muted">
                        {t("import.duplicateRows", {
                          count: preview.plan.duplicateRows,
                        })}
                      </p>
                    )}
                  </div>
                ) : preview.plan ? (
                  <p className="text-sm text-muted">
                    {t("import.willImport", { count: preview.plan.inserts })}
                  </p>
                ) : null}
              </section>

              {preview.sampleRows.length > 0 && (
                <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-lg font-semibold">
                    {t("import.preview")}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2">
                            {t("import.table.line")}
                          </th>
                          <th className="px-2 py-2">
                            {t("import.table.english")}
                          </th>
                          <th className="px-2 py-2">
                            {t("import.table.spanish")}
                          </th>
                          <th className="px-2 py-2">
                            {t("import.table.category")}
                          </th>
                          <th className="px-2 py-2">
                            {t("import.table.description")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {preview.sampleRows.map((row) => (
                          <tr key={row.line}>
                            <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">
                              {row.line}
                            </td>
                            <td className="px-2 py-2">{row.termEng}</td>
                            <td className="px-2 py-2">{row.termEsp}</td>
                            <td className="px-2 py-2">
                              {row.category || "—"}
                            </td>
                            <td className="max-w-56 truncate px-2 py-2 text-muted">
                              {row.description || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted">
                    {t("import.showing", {
                      shown: preview.sampleRows.length,
                      total: preview.counts.valid,
                    })}
                  </p>
                </section>
              )}

              {preview.errors.length > 0 && (
                <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-lg font-semibold">
                    {t("import.problemRows", {
                      count: preview.errors.length,
                    })}
                  </h2>
                  <ul className="divide-y divide-border text-sm">
                    {preview.errors.map((rowError) => (
                      <li key={rowError.line} className="py-2">
                        <span className="font-mono text-xs text-muted">
                          {t("import.line", { line: rowError.line })}
                        </span>{" "}
                        <span className="font-medium">
                          {t(ERROR_KEYS[rowError.reason])}
                        </span>
                        <span className="mt-0.5 block text-muted">
                          {rowError.termEng || "—"} / {rowError.termEsp || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted">
                    {t("import.skippedNote")}
                  </p>
                </section>
              )}

              <button
                type="button"
                onClick={() => void commit()}
                disabled={!canCommit}
                className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
              >
                {busy
                  ? t("import.importing")
                  : preview.existingCards > 0
                    ? t("import.reimport")
                    : t("import.import")}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmUndo && undo !== null}
        title={t("import.undo.confirmTitle")}
        description={
          undo
            ? t("import.undo.confirmDescription", {
                inserted: undo.inserted,
                updated: undo.updated,
                name: undo.deckName,
              })
            : undefined
        }
        confirmLabel={t("import.undo.confirm")}
        tone="danger"
        busy={undoBusy}
        onConfirm={() => void runUndo()}
        onCancel={() => setConfirmUndo(false)}
      />
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
  icon?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";

  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-semibold ${toneClass}`}>
        {icon && <span aria-hidden="true">{icon} </span>}
        {value}
      </p>
    </div>
  );
}
