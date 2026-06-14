import { sql } from "drizzle-orm";
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
