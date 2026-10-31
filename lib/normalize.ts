/**
 * Normalizes text for matching and header/status comparison:
 * trims, lowercases, strips accents and collapses whitespace.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Logical matching key for a card: normalize(termEng) + normalize(termEsp).
 */
export function matchKey(termEng: string, termEsp: string): string {
  return `${normalizeText(termEng)}|${normalizeText(termEsp)}`;
}
