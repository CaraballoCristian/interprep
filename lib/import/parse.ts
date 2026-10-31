import Papa from "papaparse";

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  parseErrors: string[];
};

export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/**
 * Parses CSV/TSV (and semicolon-separated) text. The delimiter is
 * auto-detected; the first row is treated as the header row.
 */
export function parseDelimited(text: string): ParsedTable {
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

  const [headerRow = [], ...body] = data;

  return {
    headers: headerRow.map((header) => header.replace(/^\uFEFF/, "").trim()),
    rows: body,
    delimiter: result.meta.delimiter || "",
    parseErrors: result.errors.map((error) => error.message),
  };
}
