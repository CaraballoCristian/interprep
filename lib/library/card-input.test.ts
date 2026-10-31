import { describe, expect, it } from "vitest";
import {
  normalizeCardInput,
  validateCardInput,
  type CardInput,
} from "./card-input";

const validCard: CardInput = {
  termEng: "Policy",
  termEsp: "Póliza",
  category: "Insurance",
  description: "Contract document",
  status: "new",
};

describe("validateCardInput", () => {
  it("accepts a complete card and trims its fields", () => {
    expect(
      validateCardInput({
        termEng: "  Policy  ",
        termEsp: " Póliza ",
        category: " Insurance ",
        description: " Contract document ",
        status: "learning",
      }),
    ).toEqual({
      ok: true,
      card: {
        termEng: "Policy",
        termEsp: "Póliza",
        category: "Insurance",
        description: "Contract document",
        status: "learning",
      },
    });
  });

  it("defaults a missing status to new", () => {
    const result = validateCardInput({
      termEng: "Policy",
      termEsp: "Póliza",
    });

    expect(result).toEqual({
      ok: true,
      card: {
        termEng: "Policy",
        termEsp: "Póliza",
        category: "",
        description: "",
        status: "new",
      },
    });
  });

  it("defaults a null status to new", () => {
    const result = validateCardInput({ ...validCard, status: null });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.card.status).toBe("new");
    }
  });

  it("rejects an unknown status", () => {
    expect(validateCardInput({ ...validCard, status: "bogus" })).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("rejects a non-string status", () => {
    expect(validateCardInput({ ...validCard, status: 42 })).toEqual({
      ok: false,
      error: "invalid_status",
    });
  });

  it("requires both terms", () => {
    expect(validateCardInput({ ...validCard, termEng: "   " })).toEqual({
      ok: false,
      error: "terms_required",
    });
    expect(validateCardInput({ ...validCard, termEsp: "" })).toEqual({
      ok: false,
      error: "terms_required",
    });
  });

  it("rejects non-object input", () => {
    expect(validateCardInput(null)).toEqual({
      ok: false,
      error: "terms_required",
    });
    expect(validateCardInput("Policy")).toEqual({
      ok: false,
      error: "terms_required",
    });
    expect(validateCardInput([])).toEqual({
      ok: false,
      error: "terms_required",
    });
  });

  it("ignores non-string optional fields", () => {
    const result = validateCardInput({
      termEng: "Policy",
      termEsp: "Póliza",
      category: 7,
      description: null,
    });

    expect(result).toEqual({
      ok: true,
      card: {
        termEng: "Policy",
        termEsp: "Póliza",
        category: "",
        description: "",
        status: "new",
      },
    });
  });
});

describe("normalizeCardInput", () => {
  it("normalizes a complete card", () => {
    expect(normalizeCardInput(validCard)).toEqual(validCard);
  });

  it("falls back to new for an invalid status", () => {
    expect(normalizeCardInput({ ...validCard, status: "bogus" })).toEqual({
      ...validCard,
      status: "new",
    });
  });

  it("returns an empty card for non-object input", () => {
    expect(normalizeCardInput(null)).toEqual({
      termEng: "",
      termEsp: "",
      category: "",
      description: "",
      status: "new",
    });
  });
});
