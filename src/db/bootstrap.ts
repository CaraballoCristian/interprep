import { eq, sql } from "drizzle-orm";
import { DEFAULT_DECK_NAME } from "@lib/decks/types";
import { getDb } from "./client";
import { runMigrations } from "./migrate";
import { findSettings } from "./repositories/settings";
import {
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  cards,
  decks,
  settings,
  templates,
  type CardStatus,
} from "./schema";

const DEFAULT_TEMPLATE_NAME = "Eng → Esp";

/**
 * Applies pending migrations, migrates the old dynamic statuses and seeds the
 * first-run defaults. Safe to call on every server start: every step is
 * idempotent and seeding only happens once.
 */
export function bootstrapDatabase(): void {
  runMigrations();
  migrateLegacyStatuses();
  seedDefaultDeck();
  seedFirstRun();
}

/**
 * The app always needs at least one deck. Migrations seed "General" for
 * existing databases; this covers a database whose decks were all removed by
 * an older build.
 */
function seedDefaultDeck(): void {
  const db = getDb();
  const existing = db.select().from(decks).limit(1).all();
  if (existing.length > 0) {
    return;
  }

  const now = new Date().toISOString();
  db.insert(decks)
    .values({
      id: crypto.randomUUID(),
      name: DEFAULT_DECK_NAME,
      createdAt: now,
      updatedAt: now,
    })
    .run();
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

function seedFirstRun(): void {
  const db = getDb();

  const existingSettings = db.select().from(settings).limit(1).all();
  if (existingSettings.length > 0) {
    return;
  }

  db.transaction((tx) => {
    const templateId = crypto.randomUUID();

    tx.insert(templates)
      .values({
        id: templateId,
        name: DEFAULT_TEMPLATE_NAME,
        sideA: ["termEng"],
        sideB: ["termEsp", "description"],
        categories: null,
        statuses: [...DEFAULT_CARD_STATUSES],
        continuous: false,
      })
      .run();

    tx.insert(settings)
      .values({
        id: "default",
        theme: "dark",
        language: "es",
        lastTemplateId: templateId,
      })
      .run();
  });
}

/** Returns the single settings row, creating it if it somehow went missing. */
export function getSettings() {
  const existing = findSettings();
  if (existing) {
    return existing;
  }

  seedFirstRun();

  const seeded = findSettings();
  if (!seeded) {
    throw new Error("settings row could not be created");
  }
  return seeded;
}
