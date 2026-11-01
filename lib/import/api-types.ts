import type { ColumnMapping, ImportField } from "./headers";
import type { ImportCounts, ImportRow, ImportRowError } from "./preview";

export type ImportPlanSummary = {
  inserts: number;
  updates: number;
  unchanged: number;
  preserved: number;
  duplicateRows: number;
  validRows: number;
};

export type ImportPreviewResponse = {
  headers: string[];
  delimiter: string;
  /** 1-based line number of the detected (or chosen) header row. */
  headerRow: number;
  mapping: ColumnMapping;
  missingRequired: ImportField[];
  counts: ImportCounts;
  sampleRows: ImportRow[];
  errors: ImportRowError[];
  plan: ImportPlanSummary | null;
  existingCards: number;
  parseErrors: string[];
};

export type ImportCommitResponse = {
  inserted: number;
  updated: number;
  unchanged: number;
  preserved: number;
  skippedErrors: number;
  duplicateRows: number;
};
