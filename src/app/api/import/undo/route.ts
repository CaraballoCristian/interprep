import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { getUndoSummary, undoLastImport } from "@/server/import";

export const dynamic = "force-dynamic";

/** Current pending undo, if any. */
export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ undo: getUndoSummary(user.id) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

/** Rolls back the most recent import. */
export async function POST() {
  try {
    const user = await requireUser();
    return Response.json(undoLastImport(user.id));
  } catch (cause) {
    return errorResponse(cause);
  }
}
