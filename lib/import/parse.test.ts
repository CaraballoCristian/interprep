import { describe, expect, it } from "vitest";
import { parseDelimited } from "./parse";

describe("parseDelimited", () => {
  it("parses comma-separated text", () => {
    const table = parseDelimited("English,Spanish\nPolicy,Póliza\nClaim,Reclamo\n");

    expect(table.headers).toEqual(["English", "Spanish"]);
    expect(table.rows).toEqual([
      ["Policy", "Póliza"],
      ["Claim", "Reclamo"],
    ]);
    expect(table.delimiter).toBe(",");
  });

  it("parses tab-separated text", () => {
    const table = parseDelimited("English\tSpanish\nPolicy\tPóliza\n");
    expect(table.headers).toEqual(["English", "Spanish"]);
    expect(table.rows).toEqual([["Policy", "Póliza"]]);
    expect(table.delimiter).toBe("\t");
  });

  it("parses semicolon-separated text", () => {
    const table = parseDelimited("English;Spanish\nPolicy;Póliza\n");
    expect(table.delimiter).toBe(";");
    expect(table.rows).toEqual([["Policy", "Póliza"]]);
  });

  it("keeps extra columns", () => {
    const table = parseDelimited(
      "ID,English,Spanish,Notes\n1,Policy,Póliza,keep me\n",
    );
    expect(table.headers).toEqual(["ID", "English", "Spanish", "Notes"]);
    expect(table.rows[0]).toEqual(["1", "Policy", "Póliza", "keep me"]);
  });

  it("keeps blank rows in the middle and drops trailing ones", () => {
    const table = parseDelimited("English,Spanish\nPolicy,Póliza\n\nClaim,Reclamo\n\n");
    expect(table.rows).toHaveLength(3);
    expect(table.rows[1]).toEqual([""]);
    expect(table.rows[2]).toEqual(["Claim", "Reclamo"]);
  });

  it("handles quoted values with commas", () => {
    const table = parseDelimited(
      'English,Spanish\n"Policy, premium",Prima\n',
    );
    expect(table.rows[0]).toEqual(["Policy, premium", "Prima"]);
  });

  it("returns an empty body when only headers exist", () => {
    const table = parseDelimited("English,Spanish");
    expect(table.headers).toEqual(["English", "Spanish"]);
    expect(table.rows).toEqual([]);
  });

  it("uses the first row with Nº in column A as the header", () => {
    const text = [
      "Planilla de terminología",
      "Curso 2026",
      "",
      "Datos personales",
      "Nombre,Apellido",
      "Nº,Inglés,Español,Categoría,Estado,Descripción",
      "1,Policy,Póliza,Insurance,new,Contract document",
      "2,Claim,Reclamo,Insurance,new,Claim form",
    ].join("\n");

    const table = parseDelimited(text);

    expect(table.headerRowIndex).toBe(5);
    expect(table.headerLine).toBe(6);
    expect(table.headers).toEqual([
      "Nº",
      "Inglés",
      "Español",
      "Categoría",
      "Estado",
      "Descripción",
    ]);
    expect(table.rows).toEqual([
      ["1", "Policy", "Póliza", "Insurance", "new", "Contract document"],
      ["2", "Claim", "Reclamo", "Insurance", "new", "Claim form"],
    ]);
  });

  it("ignores every row above the detected header", () => {
    const table = parseDelimited(
      "basura,ignorar\nmás basura,ignorar\nNº,English,Spanish\n1,Policy,Póliza\n",
    );

    expect(table.headerLine).toBe(3);
    expect(table.rows).toEqual([["1", "Policy", "Póliza"]]);
  });

  it("accepts an explicit header row", () => {
    const table = parseDelimited(
      "basura,ignorar\nNº,English,Spanish\n1,Policy,Póliza\n",
      { headerRow: 0 },
    );

    expect(table.headerLine).toBe(1);
    expect(table.headers).toEqual(["basura", "ignorar"]);
  });

  it("falls back to the first row that looks like a header", () => {
    const table = parseDelimited(
      "basura,ignorar\nEnglish,Spanish\nPolicy,Póliza\n",
    );

    expect(table.headerLine).toBe(2);
    expect(table.headers).toEqual(["English", "Spanish"]);
  });

  it("falls back to the first row when nothing matches", () => {
    const table = parseDelimited("Columna A,Columna B\nuno,dos\n");

    expect(table.headerLine).toBe(1);
    expect(table.headers).toEqual(["Columna A", "Columna B"]);
  });
});
