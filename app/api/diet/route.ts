import { env } from "cloudflare:workers";

type DailyRow = {
  day_date: string;
  payload: string;
  updated_at: string;
};

type SettingsRow = {
  payload: string;
  updated_at: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const USER_KEY_RE = /^[A-Za-z0-9_-]{24,128}$/;

function getDb() {
  if (!env.DB) {
    throw new Error("Cloud backup is unavailable because the D1 binding is missing.");
  }

  return env.DB;
}

function assertUserKey(value: unknown): string {
  if (typeof value !== "string" || !USER_KEY_RE.test(value)) {
    throw new Error("A valid cloud sync key is required.");
  }

  return value;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_key TEXT PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ),
    db.prepare(
      `CREATE TABLE IF NOT EXISTS daily_logs (
        user_key TEXT NOT NULL,
        day_date TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_key, day_date)
      )`,
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS daily_logs_user_date_idx ON daily_logs (user_key, day_date)",
    ),
  ]);
}

function toErrorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userKey = assertUserKey(url.searchParams.get("userKey"));
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const hasRange = start && end && DATE_RE.test(start) && DATE_RE.test(end);
    const db = getDb();

    await ensureSchema(db);

    const settings = await db
      .prepare("SELECT payload, updated_at FROM user_settings WHERE user_key = ?")
      .bind(userKey)
      .first<SettingsRow>();

    const rows = hasRange
      ? await db
          .prepare(
            "SELECT day_date, payload, updated_at FROM daily_logs WHERE user_key = ? AND day_date BETWEEN ? AND ? ORDER BY day_date",
          )
          .bind(userKey, start, end)
          .all<DailyRow>()
      : await db
          .prepare(
            "SELECT day_date, payload, updated_at FROM daily_logs WHERE user_key = ? ORDER BY day_date",
          )
          .bind(userKey)
          .all<DailyRow>();

    return Response.json({
      profile: parseJson(settings?.payload, null),
      profileUpdatedAt: settings?.updated_at ?? null,
      days: rows.results.map((row) => ({
        date: row.day_date,
        payload: parseJson(row.payload, null),
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return toErrorResponse(error, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      userKey?: unknown;
      profile?: unknown;
      days?: Record<string, unknown>;
    };
    const userKey = assertUserKey(body.userKey);
    const db = getDb();
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [];

    await ensureSchema(db);

    if (body.profile) {
      statements.push(
        db
          .prepare(
            `INSERT INTO user_settings (user_key, payload, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(user_key) DO UPDATE SET
               payload = excluded.payload,
               updated_at = excluded.updated_at`,
          )
          .bind(userKey, JSON.stringify(body.profile), now),
      );
    }

    for (const [dayDate, payload] of Object.entries(body.days ?? {})) {
      if (!DATE_RE.test(dayDate)) {
        continue;
      }

      statements.push(
        db
          .prepare(
            `INSERT INTO daily_logs (user_key, day_date, payload, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(user_key, day_date) DO UPDATE SET
               payload = excluded.payload,
               updated_at = excluded.updated_at`,
          )
          .bind(userKey, dayDate, JSON.stringify(payload), now),
      );
    }

    if (statements.length > 0) {
      await db.batch(statements);
    }

    return Response.json({
      ok: true,
      savedDays: Object.keys(body.days ?? {}).length,
      updatedAt: now,
    });
  } catch (error) {
    return toErrorResponse(error, 400);
  }
}
