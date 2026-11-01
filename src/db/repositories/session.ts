import { eq } from "drizzle-orm";
import type { StudySession } from "@lib/study/session";
import { getDb } from "../client";
import { sessionState } from "../schema";

export function loadStudySession(): StudySession | null {
  try {
    const row = getDb()
      .select()
      .from(sessionState)
      .where(eq(sessionState.id, "default"))
      .get();

    if (!row) {
      return null;
    }

    const data = row.data as unknown as StudySession;
    if (
      !data ||
      data.version !== 2 ||
      !data.config ||
      !data.round ||
      !Array.isArray(data.round.deck) ||
      !Array.isArray(data.round.queue) ||
      !Array.isArray(data.undoStack)
    ) {
      return null;
    }
    return data;
  } catch {
    // A corrupt row is treated as "no session" and rebuilt from scratch.
    return null;
  }
}

export function saveStudySession(session: StudySession): void {
  const data = session as unknown as Record<string, unknown>;

  getDb()
    .insert(sessionState)
    .values({ id: "default", data, updatedAt: session.updatedAt })
    .onConflictDoUpdate({
      target: sessionState.id,
      set: { data, updatedAt: session.updatedAt },
    })
    .run();
}

export function clearStudySession(): void {
  getDb()
    .delete(sessionState)
    .where(eq(sessionState.id, "default"))
    .run();
}
