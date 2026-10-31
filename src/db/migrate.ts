import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb } from "./client";

export function runMigrations(): void {
  const folder =
    process.env.MIGRATIONS_PATH?.trim() ||
    path.join(process.cwd(), "drizzle");

  // The drizzle folder is copied into the standalone image explicitly (see
  // Dockerfile), so tracing the whole project here is unnecessary.
  migrate(getDb(), {
    migrationsFolder: path.resolve(/* turbopackIgnore: true */ folder),
  });
}
