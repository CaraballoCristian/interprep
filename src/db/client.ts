import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

type Connection = {
  sqlite: Database.Database;
  db: Db;
};

const globalForDb = globalThis as unknown as {
  __interprepDb?: Connection;
};

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  const file =
    configured && configured.length > 0
      ? configured
      : path.join(process.cwd(), "data", "app.db");
  return path.resolve(file);
}

function createConnection(): Connection {
  const file = resolveDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  return { sqlite, db: drizzle(sqlite, { schema }) };
}

function getConnection(): Connection {
  if (!globalForDb.__interprepDb) {
    globalForDb.__interprepDb = createConnection();
  }
  return globalForDb.__interprepDb;
}

export function getDb(): Db {
  return getConnection().db;
}

export function getRawSqlite(): Database.Database {
  return getConnection().sqlite;
}
