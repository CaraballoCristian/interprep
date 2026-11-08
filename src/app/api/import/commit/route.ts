import type { ImportCommitResponse } from "@lib/import/api-types";
import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { resolveDeckId } from "@/server/decks";
import { applyImportPlan } from "@/db/repositories/cards";
import { analyzeImport, getUndoSummary } from "@/server/import";
import { importRequestSchema } from "@/server/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = importRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const user = await requireUser();
    const deckId = resolveDeckId(user.id, parsed.data.deckId);
    const analysis = analyzeImport(
      user.id,
      parsed.data.content,
      parsed.data.mapping,
      parsed.data.headerRow,
      deckId,
    );

    if (!analysis.validation.valid || !analysis.plan) {
      return Response.json(
        {
          error: "invalid_mapping",
          missingRequired: analysis.missingRequired,
        },
        { status: 400 },
      );
    }

    if (analysis.plan.validRows === 0) {
      return Response.json(
        { error: "no_valid_rows", counts: analysis.preview.counts },
        { status: 400 },
      );
    }

    const result = applyImportPlan(user.id, analysis.plan, deckId);
    const undo =
      result.inserted + result.updated > 0
        ? getUndoSummary(user.id)
        : null;

    const response: ImportCommitResponse = {
      inserted: result.inserted,
      updated: result.updated,
      unchanged: analysis.plan.unchanged,
      preserved: analysis.plan.preserved,
      skippedErrors: analysis.preview.errors.length,
      duplicateRows: analysis.plan.duplicateRows,
      undo,
    };

    return Response.json(response);
  } catch (cause) {
    return errorResponse(cause);
  }
}
