import { describe, expect, it } from "vitest";
import { detectMapping } from "./headers";
import { parseDelimited } from "./parse";
import { buildPreview } from "./preview";

const TABLE = `English,Spanish,Category,Status,Description
Policy,Póliza,Insurance,new,contract document
Claim,,Insurance,new,missing spanish term
Deductible,Deducible,Insurance,archivada,ignored status column
,Prima,Insurance,,missing english term
Coverage,Cobertura,Utilities,,`;

function previewOf(text: string) {
  const table = parseDelimited(text);
  return buildPreview(table, detectMapping(table.headers));
}

describe("buildPreview", () => {
  it("interprets valid rows and ignores the spreadsheet status", () => {
    const preview = previewOf(TABLE);

    expect(preview.rows).toHaveLength(3);
    expect(preview.rows[0]).toMatchObject({
      line: 2,
      termEng: "Policy",
      termEsp: "Póliza",
      category: "Insurance",
      description: "contract document",
    });
    expect(preview.rows[0]).not.toHaveProperty("status");
    expect(preview.rows[1]).toMatchObject({
      line: 4,
      termEng: "Deductible",
      termEsp: "Deducible",
      description: "ignored status column",
    });
    expect(preview.rows[2]).toMatchObject({
      line: 6,
      termEng: "Coverage",
      termEsp: "Cobertura",
      category: "Utilities",
      description: "",
    });
  });

  it("collects error rows with line numbers and reasons", () => {
    const preview = previewOf(TABLE);

    expect(preview.errors).toEqual([
      {
        line: 3,
        reason: "missingTermEsp",
        termEng: "Claim",
        termEsp: "",
      },
      {
        line: 5,
        reason: "missingTermEng",
        termEng: "",
        termEsp: "Prima",
      },
    ]);
  });

  it("reports counts for valid, error and empty rows", () => {
    const preview = previewOf(TABLE);
    expect(preview.counts).toEqual({
      total: 5,
      valid: 3,
      error: 2,
      empty: 0,
    });
  });

  it("counts blank rows in the middle", () => {
    const preview = previewOf(
      "English,Spanish\nPolicy,Póliza\n\nClaim,Reclamo\n",
    );
    expect(preview.counts.empty).toBe(1);
    expect(preview.counts.valid).toBe(2);
  });

  it("works when optional columns are absent", () => {
    const preview = previewOf("English,Spanish\nPolicy,Póliza\n");
    expect(preview.rows[0]).toMatchObject({
      category: "",
      description: "",
    });
  });

  it("trims cell values", () => {
    const preview = previewOf("English,Spanish\n  Policy  ,  Póliza  \n");
    expect(preview.rows[0].termEng).toBe("Policy");
    expect(preview.rows[0].termEsp).toBe("Póliza");
  });
});
