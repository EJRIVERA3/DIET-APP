/**
 * Client-side consent. This is the only place a sync key becomes linked to a
 * coach, and it is always the client's own device making the call.
 *
 *   POST /api/coach/accept  { code, userKey, label? }
 *
 * The key is written server-side and never returned to the coach. Deliberately
 * NOT coach-authenticated: the caller proves possession of both a valid invite
 * code and their own sync key.
 */
import {
  assertInviteCode,
  assertUserKey,
  ensureCoachSchema,
  getCoachDb,
  HttpError,
  toErrorResponse,
  type CoachLinkRow,
} from "../../../coach-links";

export async function POST(request: Request) {
  try {
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const body = (await request.json()) as { code?: unknown; userKey?: unknown; label?: unknown };
    const code = assertInviteCode(body.code);
    const userKey = assertUserKey(body.userKey);
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "";
    const now = new Date().toISOString();

    const link = await db
      .prepare("SELECT * FROM coach_links WHERE invite_code = ?")
      .bind(code)
      .first<CoachLinkRow>();

    if (!link) {
      throw new HttpError(404, "That invite code was not recognised.");
    }

    if (link.status === "revoked") {
      throw new HttpError(410, "That invite has been cancelled.");
    }

    if (link.status === "active") {
      /* Idempotent for the same client; a different client cannot steal it. */
      if (link.user_key === userKey) {
        return Response.json({ id: link.id, status: "active", alreadyLinked: true });
      }
      throw new HttpError(409, "That invite code has already been used.");
    }

    /* Only claim it if still pending, so two racing clients cannot both win. */
    const claimed = await db
      .prepare(
        `UPDATE coach_links
            SET user_key = ?, status = 'active', accepted_at = ?,
                client_label = CASE WHEN client_label = '' THEN ? ELSE client_label END
          WHERE id = ? AND status = 'pending'`,
      )
      .bind(userKey, now, label, link.id)
      .run();

    if (!claimed.meta.changes) {
      throw new HttpError(409, "That invite code has already been used.");
    }

    return Response.json({ id: link.id, status: "active", acceptedAt: now });
  } catch (error) {
    return toErrorResponse(error);
  }
}
