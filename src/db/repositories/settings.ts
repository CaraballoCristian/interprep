import { eq } from "drizzle-orm";
import type { DictationConfig } from "@lib/dictation/types";
import type { Language, Theme } from "@lib/types";
import { getDb } from "../client";
import { settings, type Settings } from "../schema";
import { getSettings } from "../workspace";

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

/** Last Dictado configuration, or null when the user never changed it. */
export function readDictationConfig(
  userId: string,
): DictationConfig | null {
  return getSettings(userId).dictationConfig ?? null;
}

export function writeDictationConfig(
  userId: string,
  config: DictationConfig,
): void {
  const now = new Date().toISOString();

  getDb()
    .insert(settings)
    .values({
      id: userId,
      userId,
      dictationConfig: config,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: { dictationConfig: config, updatedAt: now },
    })
    .run();
}

export type GeminiCredentials = {
  encrypted: string | null;
  hint: string | null;
};

export function readGeminiCredentials(userId: string): GeminiCredentials {
  const row = getSettings(userId);
  return {
    encrypted: row.geminiApiKeyEncrypted ?? null,
    hint: row.geminiKeyHint ?? null,
  };
}

export function writeGeminiCredentials(
  userId: string,
  encrypted: string,
  hint: string,
): void {
  const now = new Date().toISOString();

  getDb()
    .insert(settings)
    .values({
      id: userId,
      userId,
      geminiApiKeyEncrypted: encrypted,
      geminiKeyHint: hint,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        geminiApiKeyEncrypted: encrypted,
        geminiKeyHint: hint,
        updatedAt: now,
      },
    })
    .run();
}

export function clearGeminiCredentials(userId: string): void {
  const now = new Date().toISOString();

  getDb()
    .insert(settings)
    .values({
      id: userId,
      userId,
      geminiApiKeyEncrypted: null,
      geminiKeyHint: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.id,
      set: {
        geminiApiKeyEncrypted: null,
        geminiKeyHint: null,
        updatedAt: now,
      },
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
