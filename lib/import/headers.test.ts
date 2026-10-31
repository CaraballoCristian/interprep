import { describe, expect, it } from "vitest";
import {
  detectMapping,
  emptyMapping,
  missingRequiredFields,
  sanitizeMapping,
  validateMapping,
} from "./headers";

describe("detectMapping", () => {
  it("maps columns by name regardless of order", () => {
    const mapping = detectMapping([
      "Description",
      "Español",
      "Extra",
      "Inglés",
      "Categoría",
      "Estado",
    ]);

    expect(mapping.description).toBe(0);
    expect(mapping.termEsp).toBe(1);
    expect(mapping.termEng).toBe(3);
    expect(mapping.category).toBe(4);
    expect(mapping.status).toBe(5);
  });

  it("accepts aliases with accents, case and spacing", () => {
    const mapping = detectMapping([
      "TERMINO INGLES",
      "término español",
      "Category",
      "STATUS",
      "descripcion",
    ]);

    expect(mapping.termEng).toBe(0);
    expect(mapping.termEsp).toBe(1);
    expect(mapping.category).toBe(2);
    expect(mapping.status).toBe(3);
    expect(mapping.description).toBe(4);
  });

  it("ignores extra columns", () => {
    const mapping = detectMapping(["Foo", "English", "Bar", "Spanish"]);
    expect(mapping.termEng).toBe(1);
    expect(mapping.termEsp).toBe(3);
  });

  it("reports missing required headers", () => {
    const mapping = detectMapping(["English", "Notes"]);
    expect(missingRequiredFields(mapping)).toEqual(["termEsp"]);
  });

  it("handles a UTF-8 BOM in the first header", () => {
    const mapping = detectMapping(["\uFEFFInglés", "Español"]);
    expect(mapping.termEng).toBe(0);
    expect(mapping.termEsp).toBe(1);
  });

  it("uses the first matching column when a field is repeated", () => {
    const mapping = detectMapping(["English", "English", "Spanish"]);
    expect(mapping.termEng).toBe(0);
  });
});

describe("validateMapping", () => {
  it("accepts a complete mapping", () => {
    const mapping = detectMapping(["English", "Spanish", "Category"]);
    expect(validateMapping(mapping, 3)).toEqual({ valid: true, issues: [] });
  });

  it("flags missing required fields", () => {
    const mapping = emptyMapping();
    expect(validateMapping(mapping, 3).issues).toContain("required");
  });

  it("flags out-of-range columns", () => {
    const mapping = { ...emptyMapping(), termEng: 0, termEsp: 5 };
    expect(validateMapping(mapping, 3).issues).toContain("outOfRange");
  });
});

describe("sanitizeMapping", () => {
  it("drops unknown keys and invalid values", () => {
    const mapping = sanitizeMapping({
      termEng: 0,
      termEsp: -1,
      // @ts-expect-error unknown field is ignored on purpose
      nope: 2,
    });

    expect(mapping.termEng).toBe(0);
    expect(mapping.termEsp).toBeNull();
    expect(mapping.category).toBeNull();
  });
});
