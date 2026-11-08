import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardInsert, CardUpdate } from "../lib/import/plan";
import { matchKey } from "../lib/normalize";

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "interprep-import-undo-"),
);

process.env.DATABASE_PATH = path.join(tempDir, "app.db");
process.env.MIGRATIONS_PATH = path.resolve(process.cwd(), "drizzle");

let getRawSqlite: typeof import("../src/db/client").getRawSqlite;
let cardsRepo: typeof import("../src/db/repositories/cards");
let undoRepo: typeof import("../src/db/repositories/import-undo");
let decksRepo: typeof import("../src/db/repositories/decks");
let serverImport: typeof import("../src/server/import");

function createUser(id: string) {
  const now = Date.now();
  getRawSqlite()
    .prepare(
      `insert into user (id, name, email, email_verified, created_at, updated_at)
       values (?, ?, ?, 0, ?, ?)`,
    )
    .run(id, "Test", `${id}@example.com`, now, now);
}

beforeAll(async () => {
  const client = await import("../src/db/client");
  getRawSqlite = client.getRawSqlite;

  const bootstrap = await import("../src/db/bootstrap");
  bootstrap.bootstrapDatabase();

  cardsRepo = await import("../src/db/repositories/cards");
  undoRepo = await import("../src/db/repositories/import-undo");
  decksRepo = await import("../src/db/repositories/decks");
  serverImport = await import("../src/server/import");
});

afterAll(() => {
  getRawSqlite()?.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function cardInsert(
  termEng: string,
  termEsp: string,
  overrides: Partial<CardInsert> = {},
): CardInsert {
  return {
    termEng,
    termEsp,
    category: "Imported",
    description: "",
    matchKey: matchKey(termEng, termEsp),
    ...overrides,
  };
}

describe("undo import", () => {
  it("deletes inserted cards and restores updated card content", () => {
    const userId = "undo-user";
    createUser(userId);

    const deck = decksRepo.createDeck(userId, "Wrong deck");
    const existing = cardsRepo.createCard(userId, {
      deckId: deck.id,
      termEng: "Policy",
      termEsp: "Póliza",
      category: "Old category",
      description: "Old description",
      status: "new",
    });

    const insert = cardInsert("Contract", "Contrato");
    const update: CardUpdate = {
      id: existing.id,
      termEng: "policy",
      termEsp: "póliza",
      category: "Imported category",
      description: "Imported description",
    };

    cardsRepo.applyImportPlan(
      userId,
      { inserts: [insert], updates: [update] },
      deck.id,
    );

    expect(cardsRepo.listCardsForMatching(userId, deck.id)).toHaveLength(2);
    expect(undoRepo.getImportUndoSummary(userId)).toMatchObject({
      deckId: deck.id,
      deckName: "Wrong deck",
      inserted: 1,
      updated: 1,
    });

    const result = serverImport.undoLastImport(userId);

    expect(result).toEqual({
      ok: true,
      deckName: "Wrong deck",
      deleted: 1,
      restored: 1,
    });

    const restored = cardsRepo.getCardById(userId, existing.id);
    expect(restored).toMatchObject({
      termEng: "Policy",
      termEsp: "Póliza",
      category: "Old category",
      description: "Old description",
    });
    expect(cardsRepo.listCardsForMatching(userId, deck.id)).toHaveLength(1);
    expect(undoRepo.getImportUndoSummary(userId)).toBeNull();
  });

  it("rolls back completely when a restored card collides", () => {
    const userId = "conflict-user";
    createUser(userId);

    const deck = decksRepo.createDeck(userId, "Conflict deck");
    const existing = cardsRepo.createCard(userId, {
      deckId: deck.id,
      termEng: "Alpha",
      termEsp: "Alfa",
      category: "Old",
      description: "",
      status: "new",
    });

    cardsRepo.applyImportPlan(
      userId,
      {
        inserts: [],
        updates: [
          {
            id: existing.id,
            termEng: "alpha",
            termEsp: "alfa",
            category: "Imported",
            description: "",
          },
        ],
      },
      deck.id,
    );

    // Simulate a manual edit after the import that changes the match key.
    cardsRepo.updateCard(userId, existing.id, {
      deckId: deck.id,
      termEng: "Beta",
      termEsp: "Beta",
      category: "Manual",
      description: "",
      status: "new",
    });

    // Another card now owns the old match key, so restoring the snapshot
    // would violate the unique index.
    cardsRepo.createCard(userId, {
      deckId: deck.id,
      termEng: "Alpha",
      termEsp: "Alfa",
      category: "New",
      description: "",
      status: "new",
    });

    let thrown: unknown;

    try {
      serverImport.undoLastImport(userId);
    } catch (cause) {
      thrown = cause;
    }

    expect(thrown).toBeInstanceOf(serverImport.ImportUndoError);
    expect((thrown as InstanceType<typeof serverImport.ImportUndoError>).code).toBe(
      "conflict",
    );

    expect(undoRepo.getImportUndoSummary(userId)).not.toBeNull();
    expect(cardsRepo.getCardById(userId, existing.id)).toMatchObject({
      termEng: "Beta",
      termEsp: "Beta",
      category: "Manual",
    });
    expect(cardsRepo.listCardsForMatching(userId, deck.id)).toHaveLength(2);
  });
});
