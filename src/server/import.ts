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
import type {
  ImportUndoResponse,
  ImportUndoSummary,
} from "@lib/import/undo";
import { listCardsForMatching } from "@/db/repositories/cards";
import {
  applyImportUndo,
  getImportUndo,
  getImportUndoSummary,
} from "@/db/repositories/import-undo";

export type ImportUndoErrorCode = "not_found" | "conflict";

export class ImportUndoError extends Error {
  readonly code: ImportUndoErrorCode;

  constructor(code: ImportUndoErrorCode) {
    super(code);
    this.name = "ImportUndoError";
    this.code = code;
  }
}

export type ImportAnalysis = {
  table: ParsedTable;
  mapping: ColumnMapping;
  missingRequired: ReturnType<typeof missingRequiredFields>;
  validation: ReturnType<typeof validateMapping>;
  preview: ImportPreview;
  plan: ImportPlan | null;
};

/**
 * Parses the file, resolves the header row and column mapping (auto-detected
 * unless provided) and builds both the preview and the merge plan against the
 * DB. `headerRowInput` is 1-based; omitted means auto-detect.
 */
export function analyzeImport(
  userId: string,
  content: string,
  mappingInput: Partial<ColumnMapping> | undefined,
  headerRowInput: number | undefined,
  deckId: string,
): ImportAnalysis {
  const table = parseDelimited(content, {
    headerRow:
      headerRowInput === undefined ? undefined : headerRowInput - 1,
  });
  const mapping = mappingInput
    ? sanitizeMapping(mappingInput)
    : detectMapping(table.headers);

  const validation = validateMapping(mapping, table.headers.length);
  const preview = buildPreview(table, mapping);
  const plan = validation.valid
    ? buildImportPlan(preview.rows, listCardsForMatching(userId, deckId))
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

export function getUndoSummary(
  userId: string,
): ImportUndoSummary | null {
  return getImportUndoSummary(userId);
}

function isConstraintError(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) {
    return false;
  }

  const code = (cause as { code?: unknown }).code;
  return (
    typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")
  );
}

/**
 * Rolls back the most recent import for the user. If restoring a snapshot
 * would collide with a card created after the import, the whole transaction
 * is rolled back and a `conflict` error is returned.
 */
export function undoLastImport(userId: string): ImportUndoResponse {
  const record = getImportUndo(userId);

  if (!record) {
    throw new ImportUndoError("not_found");
  }

  try {
    const result = applyImportUndo(userId, record);
    return { ok: true, deckName: record.deckName, ...result };
  } catch (cause) {
    if (isConstraintError(cause)) {
      throw new ImportUndoError("conflict");
    }
    throw cause;
  }
}
