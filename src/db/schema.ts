import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  CARD_RESULTS,
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  LANGUAGES,
  SIDE_FIELDS,
  THEMES,
  type CardResult,
  type CardStatus,
  type Language,
  type SideField,
  type Theme,
} from "../../lib/types";

export {
  CARD_RESULTS,
  CARD_STATUSES,
  DEFAULT_CARD_STATUSES,
  LANGUAGES,
  SIDE_FIELDS,
  THEMES,
};
export type { CardResult, CardStatus, Language, SideField, Theme };

const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const decks = sqliteTable(
  "decks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("decks_name_unique").on(table.name)],
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    deckId: text("deck_id")
      .notNull()
      .references(() => decks.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    termEng: text("term_eng").notNull(),
    termEsp: text("term_esp").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", { enum: CARD_STATUSES }).notNull().default("new"),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    history: text("history", { mode: "json" })
      .$type<CardResult[]>()
      .notNull()
      .default(sql`'[]'`),
    totalSuccess: integer("total_success").notNull().default(0),
    totalFail: integer("total_fail").notNull().default(0),
    /** Derived matching key: normalize(termEng) + normalize(termEsp). */
    matchKey: text("match_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("cards_deck_match_unique").on(table.deckId, table.matchKey),
    index("cards_deck_idx").on(table.deckId),
    index("cards_category_idx").on(table.category),
    index("cards_status_idx").on(table.status),
    index("cards_hidden_idx").on(table.hidden),
  ],
);

export const templates = sqliteTable(
  "templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sideA: text("side_a", { mode: "json" }).$type<SideField[]>().notNull(),
    sideB: text("side_b", { mode: "json" }).$type<SideField[]>().notNull(),
    /** null means "all categories". */
    categories: text("categories", { mode: "json" }).$type<string[]>(),
    /** null means "all decks", including decks created later. */
    deckIds: text("deck_ids", { mode: "json" }).$type<string[] | null>(),
    statuses: text("statuses", { mode: "json" })
      .$type<CardStatus[]>()
      .notNull()
      .default(sql`'["new","easy","hard"]'`),
    continuous: integer("continuous", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("templates_name_unique").on(table.name)],
);

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().default("default"),
  theme: text("theme", { enum: THEMES }).notNull().default("dark"),
  language: text("language", { enum: LANGUAGES }).notNull().default("es"),
  lastTemplateId: text("last_template_id").references(() => templates.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
});

export const sessionState = sqliteTable("session_state", {
  id: text("id").primaryKey().default("default"),
  /** Serialized snapshot of the round in progress. */
  data: text("data", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  updatedAt: updatedAt(),
});

export type Deck = typeof decks.$inferSelect;
export type NewDeck = typeof decks.$inferInsert;
export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type SessionState = typeof sessionState.$inferSelect;
