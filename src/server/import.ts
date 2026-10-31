import {
  detectMapping,
  missingRequiredFields,
  sanitizeMapping,
  validateMapping,
  type ColumnMapping,
} from "@lib/import/headers";
import { buildImportPlan, type ImportPlan } from "@lib/import/plan";
import { parseDelimited, type ParsedTable } from "@lib/import/parse";
import { buildPreview, type ImportPreview } from "@lib/import/preview";
import { listCardsForMatching } from "@/db/repositories/cards";

export type ImportAnalysis = {
  table: ParsedTable;
  mapping: ColumnMapping;
  missingRequired: ReturnType<typeof missingRequiredFields>;
  validation: ReturnType<typeof validateMapping>;
  preview: ImportPreview;
  plan: ImportPlan | null;
};

/**
 * Parses the file, resolves the column mapping (auto-detected unless one is
 * provided) and builds both the preview and the merge plan against the DB.
 */
export function analyzeImport(
  content: string,
  mappingInput?: Partial<ColumnMapping>,
): ImportAnalysis {
  const table = parseDelimited(content);
  const mapping = mappingInput
    ? sanitizeMapping(mappingInput)
    : detectMapping(table.headers);

  const validation = validateMapping(mapping, table.headers.length);
  const preview = buildPreview(table, mapping);
  const plan = validation.valid
    ? buildImportPlan(preview.rows, listCardsForMatching())
    : null;

  return {
    table,
    mapping,
    missingRequired: missingRequiredFields(mapping),
    validation,
    preview,
    plan,
  };
}
