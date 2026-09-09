import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userSettings = sqliteTable("user_settings", {
  userKey: text("user_key").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyLogs = sqliteTable(
  "daily_logs",
  {
    userKey: text("user_key").notNull(),
    dayDate: text("day_date").notNull(),
    payload: text("payload").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.userKey, table.dayDate] })],
);

/**
 * Flat, queryable mirror of the numbers inside `daily_logs.payload`.
 *
 * Written on every PUT alongside the blob, so the coach roster can be one
 * indexed query rather than fetching and parsing every client's whole history.
 * Derived data only: `daily_logs` stays the source of truth and this table can
 * be rebuilt from it at any time.
 */
export const dailyTotals = sqliteTable(
  "daily_totals",
  {
    userKey: text("user_key").notNull(),
    dayDate: text("day_date").notNull(),
    /* consumed, from logged meals only */
    kcal: real("kcal").notNull().default(0),
    protein: real("protein").notNull().default(0),
    fat: real("fat").notNull().default(0),
    carbs: real("carbs").notNull().default(0),
    /* that day's targets */
    targetKcal: real("target_kcal").notNull().default(0),
    targetProtein: real("target_protein").notNull().default(0),
    targetFat: real("target_fat").notNull().default(0),
    targetCarbs: real("target_carbs").notNull().default(0),
    /* null when no weigh-in was recorded */
    weight: real("weight"),
    mealsLogged: integer("meals_logged").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.userKey, table.dayDate] })],
);

/**
 * Consent record joining a coach to a client's data.
 *
 * `user_key` stays NULL until the client accepts the invite by typing the code
 * into their own app; it is then written server-side from their request and is
 * never returned to the coach. A sync key is a read/write bearer token and the
 * client's whole identity, so it must not leave their device — the coach
 * addresses a client by this row's `id` instead.
 *
 * Revoking sets `status = 'revoked'`, which costs the client nothing.
 */
export const coachLinks = sqliteTable(
  "coach_links",
  {
    id: text("id").primaryKey(),
    coachId: text("coach_id").notNull(),
    /* null while the invite is pending */
    userKey: text("user_key"),
    clientLabel: text("client_label").notNull().default(""),
    /* pending | active | revoked */
    status: text("status").notNull().default("pending"),
    inviteCode: text("invite_code").notNull().unique(),
    /* read-only for now; kept so write scopes can be added later */
    scope: text("scope").notNull().default("read"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    acceptedAt: text("accepted_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("coach_links_coach_idx").on(table.coachId, table.status),
    index("coach_links_user_idx").on(table.userKey, table.status),
  ],
);
