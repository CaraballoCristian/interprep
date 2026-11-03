import type { ImportPreviewResponse } from "@lib/import/api-types";
import { errorResponse } from "@/server/api-errors";
import { requireUser } from "@/server/auth";
import { resolveDeckId } from "@/server/decks";
import { countCards } from "@/db/repositories/cards";
import { analyzeImport } from "@/server/import";
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
    const { plan, preview } = analysis;

    const response: ImportPreviewResponse = {
      deckId,
      headers: analysis.table.headers,
      delimiter: analysis.table.delimiter,
      headerRow: analysis.table.headerLine,
      mapping: analysis.mapping,
      missingRequired: analysis.missingRequired,
      counts: preview.counts,
      sampleRows: preview.rows.slice(0, 8),
      errors: preview.errors,
      plan: plan
        ? {
            inserts: plan.inserts.length,
            updates: plan.updates.length,
            unchanged: plan.unchanged,
            preserved: plan.preserved,
            duplicateRows: plan.duplicateRows,
            validRows: plan.validRows,
          }
        : null,
      existingCards: countCards(user.id, [deckId]),
      parseErrors: analysis.table.parseErrors,
    };

    return Response.json(response);
  } catch (cause) {
    return errorResponse(cause);
  }
}
