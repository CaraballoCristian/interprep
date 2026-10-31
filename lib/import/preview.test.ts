import { describe, expect, it } from "vitest";
import { detectMapping } from "./headers";
import { parseDelimited } from "./parse";
import { buildPreview } from "./preview";

const TABLE = `English,Spanish,Category,Status,Description
Policy,Póliza,Insurance,new,contract document
Claim,,Insurance,new,missing spanish term
Deductible,Deducible,Insurance,archivada,unknown status
,Prima,Insurance,,missing english term
Coverage,Cobertura,Utilities,,`;

function previewOf(text: string) {
  const table = parseDelimited(text);
  return buildPreview(table, detectMapping(table.headers));
}

describe("buildPreview", () => {
  it("interprets valid rows and defaults empty status to new", () => {
    const preview = previewOf(TABLE);

    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({
      line: 2,
      termEng: "Policy",
      termEsp: "Póliza",
      category: "Insurance",
      description: "contract document",
      status: "new",
    });
    expect(preview.rows[1]).toMatchObject({
      termEng: "Coverage",
      termEsp: "Cobertura",
      status: "new",
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
        status: "new",
      },
      {
        line: 4,
        reason: "unknownStatus",
        termEng: "Deductible",
        termEsp: "Deducible",
        status: "archivada",
      },
      {
        line: 5,
        reason: "missingTermEng",
        termEng: "",
        termEsp: "Prima",
        status: "",
      },
    ]);
  });

  it("reports counts for valid, error and empty rows", () => {
    const preview = previewOf(TABLE);
    expect(preview.counts).toEqual({
      total: 5,
      valid: 2,
      error: 3,
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
      status: "new",
    });
  });

  it("trims cell values", () => {
    const preview = previewOf(
      "English,Spanish\n  Policy  ,  Póliza  \n",
    );
    expect(preview.rows[0].termEng).toBe("Policy");
    expect(preview.rows[0].termEsp).toBe("Póliza");
  });
});
