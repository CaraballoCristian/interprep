import { normalizeText } from "../normalize";

export const IMPORT_FIELDS = [
  "termEng",
  "termEsp",
  "category",
  "status",
  "description",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Fields that every importable row must contain. */
export const REQUIRED_FIELDS: readonly ImportField[] = ["termEng", "termEsp"];

export type ColumnMapping = Record<ImportField, number | null>;

export function emptyMapping(): ColumnMapping {
  return {
    termEng: null,
    termEsp: null,
    category: null,
    status: null,
    description: null,
  };
}

const ALIASES: Record<ImportField, readonly string[]> = {
  category: ["categoría", "categoria", "category"],
  status: ["estado", "status"],
  termEng: [
    "inglés",
    "ingles",
    "english",
    "term eng",
    "término inglés",
    "termino ingles",
  ],
  termEsp: [
    "español",
    "espanol",
    "spanish",
    "term esp",
    "término español",
    "termino espanol",
  ],
  description: ["descripción", "descripcion", "description"],
};

const NORMALIZED_ALIASES: Record<ImportField, Set<string>> = Object.fromEntries(
  IMPORT_FIELDS.map((field) => [
    field,
    new Set(ALIASES[field].map(normalizeHeader)),
  ]),
) as Record<ImportField, Set<string>>;

function normalizeHeader(header: string): string {
  return normalizeText(header.replace(/^\uFEFF/, ""));
}

/**
 * Detects columns by header name (order-independent). When a field matches
 * more than one column, the first one wins.
 */
export function detectMapping(headers: readonly string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = emptyMapping();

  for (const field of IMPORT_FIELDS) {
    const aliases = NORMALIZED_ALIASES[field];
    const index = normalized.findIndex((header) => aliases.has(header));
    mapping[field] = index === -1 ? null : index;
  }

  return mapping;
}

export function missingRequiredFields(
  mapping: ColumnMapping,
): ImportField[] {
  return REQUIRED_FIELDS.filter((field) => mapping[field] === null);
}

/** Keeps only the keys that are known import fields. */
export function sanitizeMapping(input: Partial<ColumnMapping>): ColumnMapping {
  const mapping = emptyMapping();
  for (const field of IMPORT_FIELDS) {
    const value = input[field];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      mapping[field] = value;
    }
  }
  return mapping;
}

export type MappingIssue = "required" | "outOfRange";

/**
 * Validates a mapping against the parsed headers.
 */
export function validateMapping(
  mapping: ColumnMapping,
  columnCount: number,
): { valid: boolean; issues: MappingIssue[] } {
  const issues: MappingIssue[] = [];
  if (missingRequiredFields(mapping).length > 0) {
    issues.push("required");
  }
  const outOfRange = IMPORT_FIELDS.some((field) => {
    const index = mapping[field];
    return index !== null && index >= columnCount;
  });
  if (outOfRange) {
    issues.push("outOfRange");
  }
  return { valid: issues.length === 0, issues };
}
