import { eq } from "drizzle-orm";
import { DEFAULT_DECK_NAME } from "@lib/decks/types";
import { DEFAULT_TEMPLATE_NAME } from "@lib/templates/defaults";
import type { Language, Theme } from "@lib/types";
import { getDb } from "./client";
import {
  DEFAULT_CARD_STATUSES,
  decks,
  settings,
  templates,
  type Settings,
} from "./schema";

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_LANGUAGE: Language = "es";

/** Settings used by public pages before a user signs in. */
export const DEFAULT_SETTINGS = {
  theme: DEFAULT_THEME,
  language: DEFAULT_LANGUAGE,
} as const;

export function findUserSettings(userId: string): Settings | null {
  const row = getDb()
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .get();
  return row ?? null;
}

/**
 * Creates the first-run workspace for a user. Safe to call on every request:
 * the settings row is the idempotency marker and the whole seed runs in one
 * transaction.
 */
export function ensureUserWorkspace(userId: string): Settings {
  const db = getDb();
  const existing = findUserSettings(userId);
  if (existing) {
    return existing;
  }

  return db.transaction((tx) => {
    const current = tx
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .get();
    if (current) {
      return current;
    }

    const now = new Date().toISOString();

    const existingDeck = tx
      .select({ id: decks.id })
      .from(decks)
      .where(eq(decks.userId, userId))
      .limit(1)
      .get();

    if (!existingDeck) {
      tx.insert(decks)
        .values({
          id: crypto.randomUUID(),
          userId,
          name: DEFAULT_DECK_NAME,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const existingTemplate = tx
      .select({ id: templates.id })
      .from(templates)
      .where(eq(templates.userId, userId))
      .limit(1)
      .get();

    const templateId = existingTemplate?.id ?? crypto.randomUUID();

    if (!existingTemplate) {
      tx.insert(templates)
        .values({
          id: templateId,
          userId,
          name: DEFAULT_TEMPLATE_NAME,
          sideA: ["termEng"],
          sideB: ["termEsp", "description"],
          categories: null,
          deckIds: null,
          statuses: [...DEFAULT_CARD_STATUSES],
          continuous: false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return tx
      .insert(settings)
      .values({
        id: userId,
        userId,
        theme: DEFAULT_THEME,
        language: DEFAULT_LANGUAGE,
        lastTemplateId: templateId,
        updatedAt: now,
      })
      .returning()
      .get();
  });
}

/** Returns the user settings, creating the workspace if it is missing. */
export function getSettings(userId: string): Settings {
  return findUserSettings(userId) ?? ensureUserWorkspace(userId);
}
