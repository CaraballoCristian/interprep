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
          Modo Repetición Intensivo. Empezá importando tu planilla de
          terminología.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Empezar</h2>
        <p className="mt-1 text-sm text-muted">
          Cargá tu planilla de terminología para armar el mazo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            href="/study"
          >
            Estudiar
          </a>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/import"
          >
            Importar tarjetas
          </a>
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium"
            href="/filters"
          >
            Filtros y templates
          </a>
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
