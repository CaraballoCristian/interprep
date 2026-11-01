import { describe, expect, it } from "vitest";
import type { StudyConfig } from "../study/types";
import {
  TEMPLATE_NAME_MAX_LENGTH,
  normalizeConfig,
  sanitizeCategories,
  sanitizeSide,
  sanitizeStatuses,
  sanitizeTemplateName,
  validateConfig,
  validateTemplateName,
} from "./validation";

const validConfig: StudyConfig = {
  sideA: ["termEng"],
  sideB: ["termEsp", "description"],
  categories: ["Insurance", "Court"],
  statuses: ["new", "hard"],
  continuous: false,
};

describe("sanitizeSide", () => {
  it("keeps valid unique fields in order", () => {
    expect(
      sanitizeSide(["description", "termEng", "description", "termEng"]),
    ).toEqual(["description", "termEng"]);
  });

  it("drops unknown and non-string values", () => {
    expect(sanitizeSide(["termEsp", "category", 42, null])).toEqual([
      "termEsp",
    ]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeSide("termEng")).toEqual([]);
    expect(sanitizeSide(undefined)).toEqual([]);
  });
});

describe("sanitizeStatuses", () => {
  it("defaults to NEW/EASY/HARD when missing", () => {
    expect(sanitizeStatuses(undefined)).toEqual(["new", "easy", "hard"]);
    expect(sanitizeStatuses(null)).toEqual(["new", "easy", "hard"]);
  });

  it("keeps an explicit empty array", () => {
    expect(sanitizeStatuses([])).toEqual([]);
  });

  it("drops invalid statuses and canonicalizes the order", () => {
    expect(sanitizeStatuses(["learned", "bogus", "new", "learned"])).toEqual([
      "new",
      "learned",
    ]);
    expect(sanitizeStatuses(["hard", "easy", "new"])).toEqual([
      "new",
      "easy",
      "hard",
    ]);
  });
});

describe("sanitizeCategories", () => {
  it("maps null and missing to all categories", () => {
    expect(sanitizeCategories(null)).toBeNull();
    expect(sanitizeCategories(undefined)).toBeNull();
  });

  it("keeps an explicit empty array", () => {
    expect(sanitizeCategories([])).toEqual([]);
  });

  it("trims, deduplicates and keeps the empty category", () => {
    expect(
      sanitizeCategories([" Insurance ", "", "Court", "Insurance", 3]),
    ).toEqual(["Insurance", "", "Court"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(sanitizeCategories("Insurance")).toEqual([]);
  });
});

describe("normalizeConfig", () => {
  it("normalizes a complete config", () => {
    expect(normalizeConfig(validConfig)).toEqual(validConfig);
  });

  it("fills missing statuses and categories", () => {
    expect(
      normalizeConfig({ sideA: ["termEng"], sideB: ["termEsp"] }),
    ).toEqual({
      sideA: ["termEng"],
      sideB: ["termEsp"],
      categories: null,
      statuses: ["new", "easy", "hard"],
      continuous: false,
    });
  });

  it("returns empty sides for a non-object value", () => {
    expect(normalizeConfig(null)).toEqual({
      sideA: [],
      sideB: [],
      categories: null,
      statuses: ["new", "easy", "hard"],
      continuous: false,
    });
  });

  it("keeps continuous only when explicitly true", () => {
    expect(
      normalizeConfig({ ...validConfig, continuous: true }).continuous,
    ).toBe(true);
    expect(
      normalizeConfig({ ...validConfig, continuous: "yes" }).continuous,
    ).toBe(false);
  });
});

describe("validateConfig", () => {
  it("accepts a valid config and returns the normalized version", () => {
    const result = validateConfig({
      ...validConfig,
      sideA: ["termEng", "termEng"],
      statuses: ["hard", "new"],
    });

    expect(result).toEqual({
      ok: true,
      config: {
        ...validConfig,
        statuses: ["new", "hard"],
      },
    });
  });

  it("rejects an empty side A", () => {
    expect(validateConfig({ ...validConfig, sideA: [] })).toEqual({
      ok: false,
      error: "sides_required",
    });
  });

  it("rejects an empty side B", () => {
    expect(validateConfig({ ...validConfig, sideB: [] })).toEqual({
      ok: false,
      error: "sides_required",
    });
  });

  it("rejects overlapping sides", () => {
    expect(
      validateConfig({ ...validConfig, sideB: ["termEng", "termEsp"] }),
    ).toEqual({ ok: false, error: "sides_overlap" });
  });

  it("allows an empty status list", () => {
    expect(validateConfig({ ...validConfig, statuses: [] })).toEqual({
      ok: true,
      config: { ...validConfig, statuses: [] },
    });
  });

  it("allows no categories", () => {
    expect(validateConfig({ ...validConfig, categories: [] })).toEqual({
      ok: true,
      config: { ...validConfig, categories: [] },
    });
  });
});

describe("sanitizeTemplateName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitizeTemplateName("  spa   first_1  ")).toBe("spa first_1");
  });

  it("returns an empty string for non-string values", () => {
    expect(sanitizeTemplateName(42)).toBe("");
    expect(sanitizeTemplateName(null)).toBe("");
  });
});

describe("validateTemplateName", () => {
  it("accepts a trimmed name", () => {
    expect(validateTemplateName("  banana  ")).toEqual({
      ok: true,
      name: "banana",
    });
  });

  it("rejects blank names", () => {
    expect(validateTemplateName("   ")).toEqual({
      ok: false,
      error: "empty_name",
    });
  });

  it("rejects names longer than the limit", () => {
    expect(validateTemplateName("a".repeat(TEMPLATE_NAME_MAX_LENGTH + 1))).toEqual(
      { ok: false, error: "name_too_long" },
    );
  });

  it("accepts a name exactly at the limit", () => {
    const name = "a".repeat(TEMPLATE_NAME_MAX_LENGTH);
    expect(validateTemplateName(name)).toEqual({ ok: true, name });
  });
});
