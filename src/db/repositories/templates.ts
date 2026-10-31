import { eq } from "drizzle-orm";
import type { Template } from "../schema";
import { getDb } from "../client";
import { templates } from "../schema";

export function getTemplateById(id: string): Template | null {
  const row = getDb()
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .get();
  return row ?? null;
}

export function listTemplates(): Template[] {
  return getDb().select().from(templates).all();
}
