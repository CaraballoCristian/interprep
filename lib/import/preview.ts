import { matchKey } from "../normalize";
import type { ColumnMapping, ImportField } from "./headers";
import { isBlankRow, type ParsedTable } from "./parse";

export type ImportErrorReason = "missingTermEng" | "missingTermEsp";

export type ImportRow = {
  line: number;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  matchKey: string;
};

export type ImportRowError = {
  line: number;
  reason: ImportErrorReason;
  termEng: string;
  termEsp: string;
};

export type ImportCounts = {
  total: number;
  valid: number;
  error: number;
  empty: number;
};

export type ImportPreview = {
  rows: ImportRow[];
  errors: ImportRowError[];
  counts: ImportCounts;
};

/**
 * Interprets the parsed table using a column mapping. Rows with missing
 * required fields are collected as errors and skipped.
 *
 * The spreadsheet status column is deliberately ignored: every new card is
 * created as NEW and existing cards keep their status.
 */
export function buildPreview(
  table: ParsedTable,
  mapping: ColumnMapping,
): ImportPreview {
  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];
  let empty = 0;

  const cell = (row: readonly string[], field: ImportField): string => {
    const column = mapping[field];
    if (column === null) {
      return "";
    }
    return (row[column] ?? "").trim();
  };

  table.rows.forEach((row, index) => {
    // The header row is `headerLine`; the first body row follows it.
    const line = table.headerLine + index + 1;

    if (isBlankRow(row)) {
      empty += 1;
      return;
    }

    const termEng = cell(row, "termEng");
    const termEsp = cell(row, "termEsp");
    const category = cell(row, "category");
    const description = cell(row, "description");

    if (termEng === "") {
      errors.push({
        line,
        reason: "missingTermEng",
        termEng,
        termEsp,
      });
      return;
    }

    if (termEsp === "") {
      errors.push({
        line,
        reason: "missingTermEsp",
        termEng,
        termEsp,
      });
      return;
    }

    rows.push({
      line,
      termEng,
      termEsp,
      category,
      description,
      matchKey: matchKey(termEng, termEsp),
    });
  });

  return {
    rows,
    errors,
    counts: {
      total: rows.length + errors.length + empty,
      valid: rows.length,
      error: errors.length,
      empty,
    },
  };
}
