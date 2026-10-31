"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { StudyConfig } from "@lib/study/types";
import {
  CARD_STATUSES,
  SIDE_FIELDS,
  type CardStatus,
  type SideField,
} from "@lib/types";

const FIELD_LABELS: Record<SideField, string> = {
  termEng: "Término inglés",
  termEsp: "Término español",
  description: "Descripción",
};

const STATUS_LABELS: Record<CardStatus, string> = {
  new: "Nueva",
  learning: "Aprendiendo",
  learned: "Aprendida",
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
  templates: TemplateView[];
  cardCount: number;
  deckCount: number;
};

function readError(data: unknown): string {
  const code =
    typeof data === "object" && data !== null && "error" in data
      ? (data as { error?: string }).error
      : undefined;

  switch (code) {
    case "invalid_config":
      return "Cada lado necesita al menos un campo y no pueden compartir campos.";
    case "invalid_name":
      return "El nombre debe tener entre 1 y 80 caracteres.";
    case "duplicate_name":
      return "Ya existe un template con ese nombre.";
    case "empty_update":
      return "No hay cambios para guardar.";
    case "not_found":
      return "El template ya no existe.";
    case "invalid_input":
      return "La configuración enviada no es válida.";
    default:
      return "No se pudo completar la acción.";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function categoryLabel(category: string): string {
  return category === "" ? "Sin categoría" : category;
}

function sideLabel(side: SideField[]): string {
  return side.map((field) => FIELD_LABELS[field]).join(" + ") || "—";
}

function categoriesLabel(config: StudyConfig): string {
  if (config.categories === null) {
    return "Todas";
  }
  if (config.categories.length === 0) {
    return "Ninguna";
  }
  return config.categories.map(categoryLabel).join(", ");
}

function statusesLabel(statuses: CardStatus[]): string {
  if (statuses.length === 0) {
    return "Ninguno";
  }
  return statuses.map((status) => STATUS_LABELS[status]).join(", ");
}

export default function FiltersPage() {
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
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los filtros.",
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
  }, []);

  const refreshMeta = useCallback(async () => {
    const response = await fetch("/api/session", { cache: "no-store" });
    const body = await readJson(response);
    if (!response.ok) {
      throw new Error(readError(body));
    }
    setData(body as FiltersView);
  }, []);

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
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la acción.",
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

      const other = side === "sideA" ? "sideB" : "sideA";
      if (current[other].includes(field)) {
        return current;
      }

      const selected = current[side].includes(field);
      const next = selected
        ? current[side].filter((item) => item !== field)
        : [...current[side], field];

      return { ...current, [side]: next };
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

  function toggleCategory(category: string) {
    const all = data?.categories ?? [];

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

  function applyConfig() {
    if (!config) {
      return;
    }

    void run(async () => {
      const response = await fetch("/api/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      router.push("/study");
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
      setNotice("Template guardado. Se puede aplicar cuando quieras.");
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

      router.push("/study");
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
      setNotice("Template renombrado.");
      await refreshMeta();
    });
  }

  function overwriteTemplate(template: TemplateView) {
    if (!config) {
      return;
    }

    if (
      !window.confirm(
        `¿Sobrescribir "${template.name}" con la configuración actual?`,
      )
    ) {
      return;
    }

    void run(async () => {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(readError(body));
      }

      setNotice("Template sobrescrito.");
      await refreshMeta();
    });
  }

  function deleteTemplate(template: TemplateView) {
    if (!window.confirm(`¿Borrar el template "${template.name}"?`)) {
      return;
    }

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
      setNotice("Template borrado.");
      await refreshMeta();
    });
  }

  if (loading && !data) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl items-center justify-center px-4">
        <p className="text-sm text-muted">Cargando filtros…</p>
      </main>
    );
  }

  if (!data || !config) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p role="alert" className="text-sm text-danger">
          {error ?? "No se pudieron cargar los filtros."}
        </p>
        <Link
          href="/"
          className="flex min-h-12 items-center rounded-xl border border-border px-5 text-sm font-medium"
        >
          Volver al inicio
        </Link>
      </main>
    );
  }

  const categoriesAll = data.categories;
  const selectedCategories =
    config.categories === null
      ? new Set(categoriesAll)
      : new Set(config.categories);

  const sidesValid =
    config.sideA.length > 0 && config.sideB.length > 0;
  const overlap = config.sideA.some((field) => config.sideB.includes(field));
  const canApply = sidesValid && !overlap && !busy;
  const canSave = canApply && templateName.trim() !== "";

  const categorySummary =
    config.categories === null
      ? categoriesAll.length > 0
        ? `Todas (${categoriesAll.length})`
        : "Todas"
      : config.categories.length === 0
        ? "Ninguna"
        : `${config.categories.length} de ${categoriesAll.length}`;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Interprep
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Filtros y templates
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/study"
            className="flex min-h-12 items-center rounded-xl border border-border px-3 text-sm font-medium"
          >
            Estudiar
          </Link>
          <Link
            href="/"
            className="flex min-h-12 items-center rounded-xl border border-border px-3 text-sm font-medium"
          >
            Inicio
          </Link>
        </div>
      </header>

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
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">Lados de la tarjeta</h2>
            <p className="mt-1 text-sm text-muted">
              Un campo no puede estar en A y B a la vez. Cada lado necesita al
              menos un campo.
            </p>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
              <span>Campo</span>
              <span className="text-center">A</span>
              <span className="text-center">B</span>
            </div>

            {SIDE_FIELDS.map((field) => {
              const inA = config.sideA.includes(field);
              const inB = config.sideB.includes(field);

              return (
                <div
                  key={field}
                  className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2"
                >
                  <span className="text-sm">{FIELD_LABELS[field]}</span>

                  <label
                    className={`flex min-h-12 items-center justify-center rounded-xl border ${
                      inA
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background"
                    } ${inB ? "opacity-40" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={inA}
                      disabled={busy || inB}
                      aria-label={`Lado A: ${FIELD_LABELS[field]}`}
                      onChange={() => toggleSide("sideA", field)}
                    />
                    <span className="sr-only">
                      Lado A: {FIELD_LABELS[field]}
                    </span>
                  </label>

                  <label
                    className={`flex min-h-12 items-center justify-center rounded-xl border ${
                      inB
                        ? "border-accent bg-accent/10"
                        : "border-border bg-background"
                    } ${inA ? "opacity-40" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={inB}
                      disabled={busy || inA}
                      aria-label={`Lado B: ${FIELD_LABELS[field]}`}
                      onChange={() => toggleSide("sideB", field)}
                    />
                    <span className="sr-only">
                      Lado B: {FIELD_LABELS[field]}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>

          {!sidesValid && (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm">
              Cada lado necesita al menos un campo para poder aplicar.
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Categorías</h2>
            <span className="text-xs text-muted">{categorySummary}</span>
          </div>

          <details className="rounded-xl border border-border bg-background">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="text-muted">
                  ▾
                </span>
                Elegir categorías
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
                  Todas
                </button>
                <button
                  type="button"
                  onClick={selectNoCategories}
                  disabled={busy}
                  className="min-h-12 rounded-xl border border-border text-sm font-medium disabled:opacity-50"
                >
                  Ninguna
                </button>
              </div>

              {categoriesAll.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted">
                  Todavía no hay categorías. Importá tarjetas para verlas acá.
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
                        <span className="text-sm">{categoryLabel(category)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-lg font-semibold">Estados</h2>

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
                  <span className="text-sm">{STATUS_LABELS[status]}</span>
                </label>
              );
            })}
          </div>

          {config.statuses.length === 0 && (
            <p className="text-sm text-muted">
              Sin estados seleccionados el mazo queda vacío.
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={applyConfig}
          disabled={!canApply}
          className="min-h-14 w-full rounded-2xl bg-accent px-5 text-base font-semibold text-accent-foreground disabled:opacity-50"
        >
          Aplicar y empezar vuelta
        </button>
        <p className="text-center text-xs text-muted">
          Al aplicar se inicia una vuelta nueva con esta configuración.
        </p>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">Guardar como template</h2>
            <p className="mt-1 text-sm text-muted">
              Guarda lados, categorías y estados con un nombre. No cambia la
              vuelta en curso.
            </p>
          </div>

          <form onSubmit={saveAsTemplate} className="space-y-2">
            <label htmlFor="template-name" className="sr-only">
              Nombre del template
            </label>
            <input
              id="template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              maxLength={80}
              placeholder='Ej. "spa first_1"'
              className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-12 w-full rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-50"
            >
              Guardar template
            </button>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Templates</h2>
            <span className="text-xs text-muted">
              {data.templates.length}
            </span>
          </div>

          {data.templates.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
              No hay templates guardados.
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
                        A: {sideLabel(template.config.sideA)} → B:{" "}
                        {sideLabel(template.config.sideB)}
                      </p>
                    </div>

                    {data.templateId === template.id && (
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                        Aplicado
                      </span>
                    )}
                  </div>

                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted">Categorías</dt>
                    <dd>{categoriesLabel(template.config)}</dd>
                    <dt className="text-muted">Estados</dt>
                    <dd>{statusesLabel(template.config.statuses)}</dd>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      disabled={busy}
                      className="min-h-12 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                    <button
                      type="button"
                      onClick={() => startRename(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                    >
                      Renombrar
                    </button>
                    <button
                      type="button"
                      onClick={() => overwriteTemplate(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                    >
                      Sobrescribir
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(template)}
                      disabled={busy}
                      className="min-h-12 rounded-xl border border-danger/40 px-4 text-sm font-medium text-danger disabled:opacity-50"
                    >
                      Borrar
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
                        Nuevo nombre
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
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={busy}
                          className="min-h-12 flex-1 rounded-xl border border-border px-4 text-sm font-medium disabled:opacity-50"
                        >
                          Cancelar
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
    </main>
  );
}
