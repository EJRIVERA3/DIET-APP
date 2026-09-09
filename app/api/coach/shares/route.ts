/**
 * "Who can see my data?" — the client's own view of their shares.
 *
 *   POST /api/coach/shares  { "userKey": "..." }
 *
 * A read, but POST so the sync key travels in the body rather than a query
 * string, where it would be captured by proxy and server logs.
 *
 * Returns only this client's own links, and never the coach's token or any
 * other client's details.
 */
import {
  assertUserKey,
  ensureCoachSchema,
  getCoachDb,
  toErrorResponse,
  type CoachLinkRow,
} from "../../../coach-links";

export async function POST(request: Request) {
  try {
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const body = (await request.json()) as { userKey?: unknown };
    const userKey = assertUserKey(body.userKey);

    const rows = await db
      .prepare(
        "SELECT * FROM coach_links WHERE user_key = ? AND status <> 'pending' ORDER BY accepted_at DESC",
      )
      .bind(userKey)
      .all<CoachLinkRow>();

    return Response.json({
      shares: rows.results.map((row) => ({
        id: row.id,
        coachId: row.coach_id,
        label: row.client_label,
        status: row.status,
        scope: row.scope,
        acceptedAt: row.accepted_at,
        revokedAt: row.revoked_at,
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
