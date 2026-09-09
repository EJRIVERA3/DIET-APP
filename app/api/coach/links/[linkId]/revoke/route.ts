/**
 * Revoke a share. Either party may do it.
 *
 *   POST /api/coach/links/:linkId/revoke
 *     - as the coach:  Authorization: Bearer <COACH_TOKEN>
 *     - as the client: { "userKey": "..." } in the body
 *
 * POST rather than DELETE, and the key in the body rather than the query
 * string, because a sync key is a bearer credential and query strings end up
 * in proxy and server logs.
 *
 * Revoking is not a delete: the row stays as an audit trail of who had access
 * and when it ended. It costs the client nothing — their data and their key
 * are untouched.
 */
import {
  assertUserKey,
  authenticateCoach,
  ensureCoachSchema,
  getCoachDb,
  HttpError,
  toErrorResponse,
  type CoachLinkRow,
} from "../../../../../coach-links";

export async function POST(request: Request, context: { params: Promise<{ linkId: string }> }) {
  try {
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const { linkId } = await context.params;

    let body: { userKey?: unknown } = {};
    try {
      body = (await request.json()) as { userKey?: unknown };
    } catch {
      /* coach revocation sends no body */
    }

    const link = await db
      .prepare("SELECT * FROM coach_links WHERE id = ?")
      .bind(linkId)
      .first<CoachLinkRow>();

    /* 404 before any authorisation check would leak which ids exist, so decide
       who the caller is first and only then admit the row exists. */
    let authorised = false;

    if (typeof body.userKey === "string") {
      const userKey = assertUserKey(body.userKey);
      authorised = Boolean(link && link.user_key === userKey);
    } else {
      const coachId = authenticateCoach(request);
      authorised = Boolean(link && link.coach_id === coachId);
    }

    if (!link || !authorised) {
      throw new HttpError(404, "No such share.");
    }

    if (link.status === "revoked") {
      return Response.json({ id: link.id, status: "revoked", alreadyRevoked: true });
    }

    const now = new Date().toISOString();

    await db
      .prepare("UPDATE coach_links SET status = 'revoked', revoked_at = ? WHERE id = ?")
      .bind(now, link.id)
      .run();

    return Response.json({ id: link.id, status: "revoked", revokedAt: now });
  } catch (error) {
    return toErrorResponse(error);
  }
}
