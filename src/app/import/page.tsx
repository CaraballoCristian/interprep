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
import type { CardStatus } from "@lib/types";

const FIELD_LABELS: Record<ImportField, string> = {
  termEng: "Término inglés",
  termEsp: "Término español",
  category: "Categoría",
  status: "Estado",
  description: "Descripción",
};

const REQUIRED_FIELDS: readonly ImportField[] = ["termEng", "termEsp"];

const STATUS_LABELS: Record<CardStatus, string> = {
  new: "Nueva",
  learning: "Aprendiendo",
  learned: "Aprendida",
};

const ERROR_LABELS: Record<ImportErrorReason, string> = {
  missingTermEng: "Falta el término en inglés",
  missingTermEsp: "Falta el término en español",
  unknownStatus: "Estado desconocido",
};

const DELIMITER_LABELS: Record<string, string> = {
  ",": "coma",
  "\t": "tabulación",
  ";": "punto y coma",
  "|": "barra vertical",
};

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    switch (data.error) {
      case "invalid_mapping":
        return "Asigná las columnas requeridas antes de importar.";
      case "no_valid_rows":
        return "No hay filas válidas para importar.";
      case "invalid_input":
        return "El contenido del archivo no es válido.";
      default:
        return "Ocurrió un error inesperado.";
    }
  } catch {
    return "Ocurrió un error inesperado.";
  }
}

export default function ImportPage() {
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCommitResponse | null>(null);

  async function analyze(nextMapping?: ColumnMapping) {
    if (!content.trim()) {
      setError("Pegá o subí un archivo primero.");
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(nextMapping ? { mapping: nextMapping } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ImportPreviewResponse;
      setPreview(data);
      setMapping(data.mapping);
    } catch (cause) {
      setPreview(null);
      setMapping(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo analizar el archivo.",
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
        body: JSON.stringify({ content, mapping }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const data = (await response.json()) as ImportCommitResponse;
      setResult(data);
      setPreview(null);
      setMapping(null);
      setContent("");
      setFileName(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo importar.",
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
    setResult(null);
    setError(null);
  }

  function reset() {
    setContent("");
    setFileName(null);
    setPreview(null);
    setMapping(null);
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
    void analyze(next);
  }

  const canCommit =
    !busy &&
    preview !== null &&
    preview.plan !== null &&
    preview.plan.validRows > 0 &&
    preview.missingRequired.length === 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Interprep
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Importar tarjetas
          </h1>
        </div>
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-xl border border-border px-4 text-sm font-medium"
        >
          Inicio
        </Link>
      </header>

      {result ? (
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">Importación completada</h2>
            <p className="mt-1 text-sm text-muted">
              El estado, historial y contadores de las tarjetas existentes se
              conservaron.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nuevas" value={result.inserted} tone="success" icon="+" />
            <Stat label="Actualizadas" value={result.updated} />
            <Stat label="Sin cambios" value={result.unchanged} />
            <Stat label="Conservadas" value={result.preserved} />
          </div>

          {result.skippedErrors > 0 && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              Se saltearon {result.skippedErrors} filas con error.
            </p>
          )}

          {result.duplicateRows > 0 && (
            <p className="text-sm text-muted">
              Se ignoraron {result.duplicateRows} filas duplicadas (se usó la
              última aparición de cada término).
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="min-h-12 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            >
              Importar otro archivo
            </button>
            <Link
              href="/"
              className="flex min-h-12 items-center rounded-xl border border-border px-5 text-sm font-medium"
            >
              Volver al inicio
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
              Pegá el CSV o TSV
            </label>
            <textarea
              id="import-content"
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setPreview(null);
                setMapping(null);
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
                Subir archivo
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                  onChange={(event) => void onFile(event)}
                  className="sr-only"
                />
              </label>
              <span className="text-sm text-muted">
                {fileName ?? "o pegá el texto arriba"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void analyze()}
              disabled={busy || content.trim() === ""}
              className="min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
            >
              {busy && !preview ? "Analizando…" : "Analizar"}
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
                  <h2 className="text-lg font-semibold">Columnas</h2>
                  <span className="text-xs text-muted">
                    Separador:{" "}
                    {DELIMITER_LABELS[preview.delimiter] ??
                      preview.delimiter ??
                      "—"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {IMPORT_FIELDS.map((field) => (
                    <label key={field} className="block text-sm">
                      <span className="mb-1 block font-medium">
                        {FIELD_LABELS[field]}
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
                        <option value="">— Sin asignar —</option>
                        {preview.headers.map((header, index) => (
                          <option key={`${field}-${index}`} value={index}>
                            {header || `Columna ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {preview.missingRequired.length > 0 && (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
                    Asigná las columnas requeridas:{" "}
                    {preview.missingRequired
                      .map((field) => FIELD_LABELS[field])
                      .join(", ")}
                    .
                  </p>
                )}

                {preview.parseErrors.length > 0 && (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
                    El archivo tiene {preview.parseErrors.length} problema(s) de
                    formato. Se intentó interpretar igual.
                  </p>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                <h2 className="text-lg font-semibold">Resumen</h2>

                <div className="grid grid-cols-3 gap-2">
                  <Stat
                    label="Válidas"
                    value={preview.counts.valid}
                    tone="success"
                    icon="✓"
                  />
                  <Stat
                    label="Con error"
                    value={preview.counts.error}
                    tone="danger"
                    icon="✕"
                  />
                  <Stat label="Vacías" value={preview.counts.empty} icon="—" />
                </div>

                {preview.plan && preview.existingCards > 0 ? (
                  <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
                    <p className="text-sm">
                      Ya hay {preview.existingCards} tarjetas. Reimportar
                      actualiza las coincidentes y conserva estado, historial y
                      contadores. Las tarjetas que no están en el archivo se
                      conservan.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Nuevas" value={preview.plan.inserts} />
                      <Stat
                        label="Actualizadas"
                        value={preview.plan.updates}
                      />
                      <Stat label="Sin cambios" value={preview.plan.unchanged} />
                      <Stat label="Conservadas" value={preview.plan.preserved} />
                    </div>
                    {preview.plan.duplicateRows > 0 && (
                      <p className="text-sm text-muted">
                        {preview.plan.duplicateRows} fila(s) duplicada(s): se usa
                        la última aparición de cada término.
                      </p>
                    )}
                  </div>
                ) : preview.plan ? (
                  <p className="text-sm text-muted">
                    Se van a importar {preview.plan.inserts} tarjetas nuevas.
                  </p>
                ) : null}
              </section>

              {preview.sampleRows.length > 0 && (
                <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-lg font-semibold">Vista previa</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="whitespace-nowrap px-2 py-2">Línea</th>
                          <th className="px-2 py-2">Inglés</th>
                          <th className="px-2 py-2">Español</th>
                          <th className="px-2 py-2">Categoría</th>
                          <th className="px-2 py-2">Estado</th>
                          <th className="px-2 py-2">Descripción</th>
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
                            <td className="px-2 py-2">{row.category || "—"}</td>
                            <td className="whitespace-nowrap px-2 py-2">
                              {STATUS_LABELS[row.status]}
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
                    Mostrando {preview.sampleRows.length} de{" "}
                    {preview.counts.valid} filas válidas.
                  </p>
                </section>
              )}

              {preview.errors.length > 0 && (
                <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-lg font-semibold">
                    Filas con problemas ({preview.errors.length})
                  </h2>
                  <ul className="divide-y divide-border text-sm">
                    {preview.errors.map((rowError) => (
                      <li key={rowError.line} className="py-2">
                        <span className="font-mono text-xs text-muted">
                          Línea {rowError.line}
                        </span>{" "}
                        <span className="font-medium">
                          {ERROR_LABELS[rowError.reason]}
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
                    Estas filas se saltean y no frenan la importación.
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
                  ? "Importando…"
                  : preview.existingCards > 0
                    ? "Reimportar"
                    : "Importar"}
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
