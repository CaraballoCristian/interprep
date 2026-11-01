import Papa from "papaparse";
import { normalizeText } from "../normalize";
import { detectMapping, IMPORT_FIELDS } from "./headers";

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  parseErrors: string[];
  /** 1-based line number of the header row in the source text. */
  headerLine: number;
  /** 0-based index of the header row among the parsed rows. */
  headerRowIndex: number;
};

export type ParseOptions = {
  /**
   * 0-based index of the header row. When omitted, the first row whose first
   * cell is a numbering marker (for example `Nº`) is used.
   */
  headerRow?: number;
};

/**
 * Column A markers that identify the header row. The sheets used with the app
 * always number their rows, so the first row starting with `Nº` is the header.
 */
const HEADER_MARKERS = new Set([
  "nº",
  "n°",
  "n.º",
  "nro",
  "nro.",
  "no",
  "no.",
  "número",
  "numero",
  "#",
]);

/** How many leading rows are inspected when no numbering marker exists. */
const FALLBACK_SCAN_LIMIT = 20;

export function isNumberingHeader(cell: string): boolean {
  return HEADER_MARKERS.has(normalizeText(cell));
}

/**
 * Finds the header row: the first row whose first cell is a numbering marker.
 * Without a marker, the first row that looks like a known header wins; if
 * nothing matches, the first row is used (the historical behavior).
 */
export function detectHeaderRow(rows: readonly string[][]): number {
  const marker = rows.findIndex((row) => isNumberingHeader(row[0] ?? ""));
  if (marker !== -1) {
    return marker;
  }

  const limit = Math.min(rows.length, FALLBACK_SCAN_LIMIT);
  let bestIndex = 0;
  let bestScore = 0;

  for (let index = 0; index < limit; index += 1) {
    const mapping = detectMapping(rows[index] ?? []);
    const score = IMPORT_FIELDS.filter((field) => mapping[field] !== null).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  // At least two recognized columns are needed to trust the row as a header.
  return bestScore >= 2 ? bestIndex : 0;
}

export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/**
 * Parses CSV/TSV (and semicolon-separated) text. The delimiter is
 * auto-detected and the header row is resolved with `detectHeaderRow` unless
 * an explicit row is provided. Rows above the header are ignored.
 */
export function parseDelimited(
  text: string,
  options: ParseOptions = {},
): ParsedTable {
  // Papa's delimiter guesser is thrown off by trailing blank lines, so trim
  // the outer whitespace before parsing. Blank lines in the middle are kept.
  const input = text.trim();

  const result = Papa.parse<string[]>(input, {
    header: false,
    skipEmptyLines: false,
    delimiter: "",
  });

  const data = result.data.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      typeof cell === "string" ? cell : String(cell ?? ""),
    ),
  );

  // A trailing newline produces an extra blank row: drop trailing blanks.
  while (data.length > 0 && isBlankRow(data[data.length - 1])) {
    data.pop();
  }

  const requested = options.headerRow;
  const headerRowIndex =
    requested !== undefined && requested >= 0 && requested < data.length
      ? requested
      : detectHeaderRow(data);

  const headerRow = data[headerRowIndex] ?? [];
  const body = data.slice(headerRowIndex + 1);

  return {
    headers: headerRow.map((header) => header.replace(/^\uFEFF/, "").trim()),
    rows: body,
    delimiter: result.meta.delimiter || "",
    parseErrors: result.errors.map((error) => error.message),
    headerLine: headerRowIndex + 1,
    headerRowIndex,
  };
}
