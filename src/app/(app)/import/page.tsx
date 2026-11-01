"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
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
import type { TranslationKey } from "@lib/i18n/dictionary";
import type { CardStatus } from "@lib/types";
import { PageHeading } from "@/components/page-heading";
import { useI18n } from "@/components/settings-provider";

const FIELD_KEYS: Record<ImportField, TranslationKey> = {
  termEng: "field.termEng",
  termEsp: "field.termEsp",
  category: "field.category",
  status: "field.status",
  description: "field.description",
};

const REQUIRED_FIELDS: readonly ImportField[] = ["termEng", "termEsp"];

const STATUS_KEYS: Record<CardStatus, TranslationKey> = {
  new: "status.new",
  learning: "status.learning",
  learned: "status.learned",
};

const ERROR_KEYS: Record<ImportErrorReason, TranslationKey> = {
  missingTermEng: "import.error.missingTermEng",
  missingTermEsp: "import.error.missingTermEsp",
  unknownStatus: "import.error.unknownStatus",
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
  const [result, setResult] = useState<ImportCommitResponse | null>(null);

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
  }) {
    if (!content.trim()) {
      setError(t("import.error.pasteFirst"));
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const headerRow = options?.headerRow ?? preview?.headerRow;

    try {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
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
    if (!mapping) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          mapping,
          ...(preview ? { headerRow: preview.headerRow } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ImportCommitResponse;
      setResult(data);
      setPreview(null);
      setMapping(null);
      setHeaderRowInput("");
      setContent("");
      setFileName(null);
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
  }

  function reset() {
    setContent("");
    setFileName(null);
    setPreview(null);
    setMapping(null);
    setHeaderRowInput("");
    setResult(null);
    setError(null);
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
    preview !== null &&
    preview.plan !== null &&
    preview.plan.validRows > 0 &&
    preview.missingRequired.length === 0;

  const delimiterKey = preview ? DELIMITER_KEYS[preview.delimiter] : undefined;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-6">
      <PageHeading title={t("import.title")} />

      {result ? (
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">{t("import.doneTitle")}</h2>
            <p className="mt-1 text-sm text-muted">
              {t("import.doneDescription")}
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
          </div>
        </section>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
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
                "English,Spanish,Category,Status,Description\nPolicy,Póliza,Insurance,new,Contract document"
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
              disabled={busy || content.trim() === ""}
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
                            {t("import.table.status")}
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
                            <td className="whitespace-nowrap px-2 py-2">
                              {t(STATUS_KEYS[row.status])}
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
                        {rowError.reason === "unknownStatus" &&
                          rowError.status !== "" && (
                            <span className="text-muted">
                              {": "}
                              {rowError.status}
                            </span>
                          )}
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
