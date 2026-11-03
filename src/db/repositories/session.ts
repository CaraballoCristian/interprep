import { eq } from "drizzle-orm";
import {
  normalizeStudySession,
  type StudySession,
} from "@lib/study/session";
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

    return normalizeStudySession(row.data);
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
