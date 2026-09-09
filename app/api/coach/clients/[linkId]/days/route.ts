/**
 * Detail view for one client.
 *
 *   GET /api/coach/clients/:linkId/days?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns the day payloads themselves, so the coach can see individual meals.
 * `requireActiveLink` resolves the sync key server-side and refuses anything
 * that is not an active link belonging to this coach; the key is never echoed
 * back in the response.
 *
 * The range is capped so a single call cannot pull an entire history.
 */
import {
  authenticateCoach,
  DATE_RE,
  ensureCoachSchema,
  getCoachDb,
  HttpError,
  requireActiveLink,
  toErrorResponse,
} from "../../../../../coach-links";

const MAX_RANGE_DAYS = 92;

type DayRow = {
  day_date: string;
  payload: string;
  updated_at: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseJson(value: unknown) {
  if (typeof value !== "string") {
    return value ?? null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: { params: Promise<{ linkId: string }> }) {
  try {
    const coachId = authenticateCoach(request);
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const { linkId } = await context.params;
    const link = await requireActiveLink(db, coachId, linkId);

    const url = new URL(request.url);
    const today = new Date();
    const end = url.searchParams.get("end") ?? isoDate(today);
    const start = url.searchParams.get("start") ?? isoDate(new Date(today.getTime() - 13 * 86_400_000));

    if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
      throw new HttpError(400, "start and end must be YYYY-MM-DD.");
    }

    if (start > end) {
      throw new HttpError(400, "start must not be after end.");
    }

    const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000 + 1;
    if (span > MAX_RANGE_DAYS) {
      throw new HttpError(400, `Range too wide - ask for at most ${MAX_RANGE_DAYS} days.`);
    }

    const rows = await db
      .prepare(
        `SELECT day_date, payload, updated_at
           FROM daily_logs
          WHERE user_key = ? AND day_date BETWEEN ? AND ?
          ORDER BY day_date`,
      )
      .bind(link.user_key, start, end)
      .all<DayRow>();

    return Response.json({
      client: { id: link.id, label: link.client_label },
      range: { start, end },
      days: rows.results.map((row) => ({
        date: row.day_date,
        payload: parseJson(row.payload),
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
