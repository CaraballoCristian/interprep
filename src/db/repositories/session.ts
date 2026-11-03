import { eq } from "drizzle-orm";
import {
  normalizeStudySession,
  type StudySession,
} from "@lib/study/session";
import { getDb } from "../client";
import { sessionState } from "../schema";

export function loadStudySession(userId: string): StudySession | null {
  try {
    const row = getDb()
      .select()
      .from(sessionState)
      .where(eq(sessionState.userId, userId))
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

export function saveStudySession(
  userId: string,
  session: StudySession,
): void {
  const data = session as unknown as Record<string, unknown>;

  getDb()
    .insert(sessionState)
    .values({
      id: userId,
      userId,
      data,
      updatedAt: session.updatedAt,
    })
    .onConflictDoUpdate({
      target: sessionState.id,
      set: { data, updatedAt: session.updatedAt },
    })
    .run();
}
