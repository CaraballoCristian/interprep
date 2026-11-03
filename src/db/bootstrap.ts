import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { runMigrations } from "./migrate";
import {
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  cards,
  templates,
  type CardStatus,
} from "./schema";

/**
 * Applies pending migrations and migrates the old dynamic statuses. Safe to
 * call on every server start: every step is idempotent. Per-user workspaces
 * are seeded lazily by `ensureUserWorkspace` on the first authenticated
 * request, because there is no user before login.
 */
export function bootstrapDatabase(): void {
  runMigrations();
  migrateLegacyStatuses();
}

function isCardStatus(value: unknown): value is CardStatus {
  return (
    typeof value === "string" &&
    (CARD_STATUSES as readonly string[]).includes(value)
  );
}

/** Keeps valid statuses in canonical order, falling back to the default set. */
function canonicalStatuses(value: readonly unknown[]): CardStatus[] {
  const selected = new Set(value.filter(isCardStatus));
  const statuses = CARD_STATUSES.filter((status) => selected.has(status));
  return statuses.length > 0 ? statuses : [...DEFAULT_CARD_STATUSES];
}

/**
 * One-time data migration for databases created with the old status model:
 * - cards: `learning` becomes `hard`; unknown values become `new`.
 * - templates: `learning` becomes `easy` and `learned` becomes `hard` only
 *   when the stored array still contains the legacy `learning` value, so new
 *   templates that intentionally select `learned` are left untouched.
 */
function migrateLegacyStatuses(): void {
  const db = getDb();

  db.update(cards)
    .set({ status: "hard" })
    .where(sql`${cards.status} = 'learning'`)
    .run();

  db.update(cards)
    .set({ status: "new" })
    .where(sql`${cards.status} not in ('new', 'easy', 'hard', 'learned')`)
    .run();

  for (const template of db.select().from(templates).all()) {
    const raw = (
      Array.isArray(template.statuses) ? template.statuses : []
    ) as unknown as string[];
    const hasLegacy = raw.some((status) => status === "learning");

    const mapped = hasLegacy
      ? raw.map((status) => {
          if (status === "learning") {
            return "easy";
          }
          if (status === "learned") {
            return "hard";
          }
          return status;
        })
      : raw;

    const statuses = canonicalStatuses(mapped);
    const changed =
      statuses.length !== raw.length ||
      statuses.some((status, index) => status !== raw[index]);

    if (changed) {
      db.update(templates)
        .set({ statuses })
        .where(eq(templates.id, template.id))
        .run();
    }
  }
}
