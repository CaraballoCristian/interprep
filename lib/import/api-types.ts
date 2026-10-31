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
