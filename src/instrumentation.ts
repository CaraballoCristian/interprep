export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { assertRuntimeEnv } = await import("./lib/env");
  assertRuntimeEnv();

  const { bootstrapDatabase } = await import("./db/bootstrap");
  bootstrapDatabase();
}
