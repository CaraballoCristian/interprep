import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const CARD_STATUSES = ["new", "learning", "learned"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export const CARD_RESULTS = ["s", "f"] as const;
export type CardResult = (typeof CARD_RESULTS)[number];

export const SIDE_FIELDS = ["termEng", "termEsp", "description"] as const;
export type SideField = (typeof SIDE_FIELDS)[number];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["es", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
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
    uniqueIndex("cards_match_key_unique").on(table.matchKey),
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
    statuses: text("statuses", { mode: "json" })
      .$type<CardStatus[]>()
      .notNull()
      .default(sql`'["new","learning","learned"]'`),
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

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type SessionState = typeof sessionState.$inferSelect;
