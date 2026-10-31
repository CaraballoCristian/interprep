import { matchKey } from "../normalize";
import type { CardStatus } from "../types";
import type { ColumnMapping, ImportField } from "./headers";
import { isBlankRow, type ParsedTable } from "./parse";
import { normalizeStatus } from "./status";

export type ImportErrorReason =
  | "missingTermEng"
  | "missingTermEsp"
  | "unknownStatus";

export type ImportRow = {
  line: number;
  termEng: string;
  termEsp: string;
  category: string;
  description: string;
  status: CardStatus;
  matchKey: string;
};

export type ImportRowError = {
  line: number;
  reason: ImportErrorReason;
  termEng: string;
  termEsp: string;
  status: string;
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
 * required fields or unknown statuses are collected as errors and skipped.
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
    // Header occupies line 1.
    const line = index + 2;

    if (isBlankRow(row)) {
      empty += 1;
      return;
    }

    const termEng = cell(row, "termEng");
    const termEsp = cell(row, "termEsp");
    const category = cell(row, "category");
    const description = cell(row, "description");
    const rawStatus = cell(row, "status");

    if (termEng === "") {
      errors.push({
        line,
        reason: "missingTermEng",
        termEng,
        termEsp,
        status: rawStatus,
      });
      return;
    }

    if (termEsp === "") {
      errors.push({
        line,
        reason: "missingTermEsp",
        termEng,
        termEsp,
        status: rawStatus,
      });
      return;
    }

    const status = normalizeStatus(rawStatus);
    if (status === null) {
      errors.push({
        line,
        reason: "unknownStatus",
        termEng,
        termEsp,
        status: rawStatus,
      });
      return;
    }

    rows.push({
      line,
      termEng,
      termEsp,
      category,
      description,
      status,
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
