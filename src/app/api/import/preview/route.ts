import type { ImportPreviewResponse } from "@lib/import/api-types";
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

  const analysis = analyzeImport(
    parsed.data.content,
    parsed.data.mapping,
    parsed.data.headerRow,
  );
  const { plan, preview } = analysis;

  const response: ImportPreviewResponse = {
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
    existingCards: countCards(),
    parseErrors: analysis.table.parseErrors,
  };

  return Response.json(response);
}
