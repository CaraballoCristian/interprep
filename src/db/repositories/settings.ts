import { eq } from "drizzle-orm";
import type { Language, Theme } from "@lib/types";
import { getDb } from "../client";
import { settings, type Settings } from "../schema";

export function findSettings(userId: string): Settings | null {
  const row = getDb()
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .get();
  return row ?? null;
}

/**
 * Sets the last applied template. Creates the settings row if it is missing,
 * so this never silently does nothing.
 */
export function setLastTemplateId(
  userId: string,
  templateId: string | null,
): void {
  const now = new Date().toISOString();

  getDb()
    .insert(settings)
    .values({
      id: userId,
      userId,
      lastTemplateId: templateId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: { lastTemplateId: templateId, updatedAt: now },
    })
    .run();
}

/** Partial update of the user preferences. Unknown fields are never written. */
export function updateSettings(
  userId: string,
  input: {
    theme?: Theme;
    language?: Language;
  },
): Settings {
  const now = new Date().toISOString();

  return getDb()
    .insert(settings)
    .values({
      id: userId,
      userId,
      ...(input.theme ? { theme: input.theme } : {}),
      ...(input.language ? { language: input.language } : {}),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.language ? { language: input.language } : {}),
        updatedAt: now,
      },
    })
    .returning()
    .get();
}
