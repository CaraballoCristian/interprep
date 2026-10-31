export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { bootstrapDatabase } = await import("./db/bootstrap");
  bootstrapDatabase();
}
