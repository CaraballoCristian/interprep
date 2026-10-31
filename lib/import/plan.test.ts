import { describe, expect, it } from "vitest";
import { matchKey } from "../normalize";
import { buildImportPlan, type ExistingCard } from "./plan";
import type { ImportRow } from "./preview";

function row(
  termEng: string,
  termEsp: string,
  overrides: Partial<ImportRow> = {},
): ImportRow {
  return {
    line: 2,
    termEng,
    termEsp,
    category: "Insurance",
    description: "",
    status: "new",
    matchKey: matchKey(termEng, termEsp),
    ...overrides,
  };
}

function existing(
  id: string,
  termEng: string,
  termEsp: string,
  overrides: Partial<ExistingCard> = {},
): ExistingCard {
  return {
    id,
    matchKey: matchKey(termEng, termEsp),
    termEng,
    termEsp,
    category: "Insurance",
    description: "",
    ...overrides,
  };
}

describe("buildImportPlan", () => {
  it("inserts cards that do not exist yet", () => {
    const plan = buildImportPlan([row("Policy", "Póliza")], []);

    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      termEng: "Policy",
      termEsp: "Póliza",
      status: "new",
    });
    expect(plan.updates).toHaveLength(0);
    expect(plan.preserved).toBe(0);
  });

  it("updates category and description of matching cards", () => {
    const plan = buildImportPlan(
      [
        row("Policy", "Póliza", {
          category: "Insurance 101",
          description: "contract",
        }),
      ],
      [existing("1", "Policy", "Póliza")],
    );

    expect(plan.updates).toEqual([
      {
        id: "1",
        termEng: "Policy",
        termEsp: "Póliza",
        category: "Insurance 101",
        description: "contract",
      },
    ]);
    expect(plan.inserts).toHaveLength(0);
  });

  it("updates the display text when only case or accents change", () => {
    const plan = buildImportPlan(
      [row("policy", "poliza")],
      [existing("1", "Policy", "Póliza")],
    );

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0]).toMatchObject({
      termEng: "policy",
      termEsp: "poliza",
    });
  });

  it("counts matched cards with identical fields as unchanged", () => {
    const plan = buildImportPlan(
      [row("Policy", "Póliza")],
      [existing("1", "Policy", "Póliza")],
    );

    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("preserves cards that are absent from the file", () => {
    const plan = buildImportPlan(
      [row("Policy", "Póliza")],
      [existing("1", "Policy", "Póliza"), existing("2", "Claim", "Reclamo")],
    );

    expect(plan.preserved).toBe(1);
  });

  it("keeps the last occurrence of duplicated keys", () => {
    const plan = buildImportPlan(
      [
        row("Policy", "Póliza", { category: "Old" }),
        row("policy", "POLIZA", { category: "New" }),
      ],
      [],
    );

    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].category).toBe("New");
    expect(plan.duplicateRows).toBe(1);
  });

  it("never touches status, hidden, history or counters", () => {
    const plan = buildImportPlan(
      [row("Policy", "Póliza", { status: "learned", category: "Changed" })],
      [existing("1", "Policy", "Póliza")],
    );

    const update = plan.updates[0] as Record<string, unknown>;
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("hidden");
    expect(update).not.toHaveProperty("history");
    expect(update).not.toHaveProperty("totalSuccess");
    expect(update).not.toHaveProperty("totalFail");
  });

  it("re-importing the same file produces no updates", () => {
    const rows = [row("Policy", "Póliza"), row("Claim", "Reclamo")];
    const cards = [
      existing("1", "Policy", "Póliza"),
      existing("2", "Claim", "Reclamo"),
    ];

    const plan = buildImportPlan(rows, cards);

    expect(plan.updates).toHaveLength(0);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.unchanged).toBe(2);
    expect(plan.preserved).toBe(0);
  });
});
