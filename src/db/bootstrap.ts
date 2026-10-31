import { getDb } from "./client";
import { runMigrations } from "./migrate";
import { findSettings } from "./repositories/settings";
import { CARD_STATUSES, settings, templates } from "./schema";

const DEFAULT_TEMPLATE_NAME = "Eng → Esp";

/**
 * Applies pending migrations and seeds the first-run defaults.
 * Safe to call on every server start: seeding only happens once,
 * when the settings row does not exist yet.
 */
export function bootstrapDatabase(): void {
  runMigrations();
  seedFirstRun();
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
        statuses: [...CARD_STATUSES],
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
