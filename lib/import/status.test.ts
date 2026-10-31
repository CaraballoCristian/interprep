import { describe, expect, it } from "vitest";
import { normalizeStatus } from "./status";

describe("normalizeStatus", () => {
  it("maps every known alias to the internal enum", () => {
    expect(normalizeStatus("Nueva")).toBe("new");
    expect(normalizeStatus("nuevo")).toBe("new");
    expect(normalizeStatus("New")).toBe("new");
    expect(normalizeStatus("NUEVA")).toBe("new");

    expect(normalizeStatus("Aprendiendo")).toBe("learning");
    expect(normalizeStatus("learning")).toBe("learning");

    expect(normalizeStatus("Aprendida")).toBe("learned");
    expect(normalizeStatus("aprendido")).toBe("learned");
    expect(normalizeStatus("Learned")).toBe("learned");
  });

  it("defaults empty values to new", () => {
    expect(normalizeStatus("")).toBe("new");
    expect(normalizeStatus("   ")).toBe("new");
  });

  it("returns null for unknown values", () => {
    expect(normalizeStatus("archivada")).toBeNull();
    expect(normalizeStatus("done")).toBeNull();
  });
});
