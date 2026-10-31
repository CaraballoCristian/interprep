export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          Interprep
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Interpreter terminology trainer
        </h1>
        <p className="text-base text-muted">
          Modo Repetición Intensivo. La base está lista: Next.js, Tailwind,
          SQLite y migraciones.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Estado</h2>
        <p className="mt-1 text-sm text-muted">
          Fase 1 completada. El importador y el motor de estudio llegan en las
          próximas fases.
        </p>
        <a
          className="mt-4 inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
          href="/api/health"
        >
          Verificar /api/health
        </a>
      </section>
    </main>
  );
}
