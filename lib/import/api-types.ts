import type { ColumnMapping, ImportField } from "./headers";
import type { ImportCounts, ImportRow, ImportRowError } from "./preview";
import type { ImportUndoSummary } from "./undo";

export type ImportPlanSummary = {
  inserts: number;
  updates: number;
  unchanged: number;
  preserved: number;
  duplicateRows: number;
  validRows: number;
};

export type ImportPreviewResponse = {
  deckId: string;
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
  /** Present when this import created a new undo snapshot. */
  undo: ImportUndoSummary | null;
};
