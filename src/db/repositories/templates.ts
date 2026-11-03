import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { CardStatus, SideField } from "@lib/types";
import { getDb } from "../client";
import { templates, type Template } from "../schema";

export function getTemplateById(
  userId: string,
  id: string,
): Template | null {
  const row = getDb()
    .select()
    .from(templates)
    .where(and(eq(templates.userId, userId), eq(templates.id, id)))
    .get();
  return row ?? null;
}

export function listTemplates(userId: string): Template[] {
  return getDb()
    .select()
    .from(templates)
    .where(eq(templates.userId, userId))
    .orderBy(asc(templates.createdAt), asc(templates.name))
    .all();
}

/**
 * Finds a template by name, case-insensitively. `excludeId` is used when
 * renaming so a template does not collide with itself.
 */
export function findTemplateByName(
  userId: string,
  name: string,
  excludeId?: string,
): Template | null {
  const matchesName = sql`lower(${templates.name}) = lower(${name})`;
  const where = excludeId
    ? and(
        eq(templates.userId, userId),
        matchesName,
        ne(templates.id, excludeId),
      )
    : and(eq(templates.userId, userId), matchesName);

  const row = getDb().select().from(templates).where(where).get();
  return row ?? null;
}

export type TemplateInput = {
  name: string;
  sideA: SideField[];
  sideB: SideField[];
  categories: string[] | null;
  deckIds: string[] | null;
  statuses: CardStatus[];
  continuous: boolean;
};

export type TemplatePatch = Partial<TemplateInput>;

export function createTemplate(
  userId: string,
  input: TemplateInput,
): Template {
  const now = new Date().toISOString();

  return getDb()
    .insert(templates)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function updateTemplate(
  userId: string,
  id: string,
  patch: TemplatePatch,
): Template | null {
  const row = getDb()
    .update(templates)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(templates.userId, userId), eq(templates.id, id)))
    .returning()
    .get();

  return row ?? null;
}

/** Returns false when the template did not exist. */
export function deleteTemplate(userId: string, id: string): boolean {
  const result = getDb()
    .delete(templates)
    .where(and(eq(templates.userId, userId), eq(templates.id, id)))
    .run();
  return result.changes > 0;
}
