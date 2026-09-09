/**
 * Coach-side invite management.
 *
 *   POST /api/coach/invites   { label? }  -> creates a pending invite + code
 *   GET  /api/coach/invites               -> every link this coach has
 *
 * Both require the coach bearer token. The invite code is the only secret
 * handed out, it names no client, and it is single-use.
 */
import {
  authenticateCoach,
  ensureCoachSchema,
  getCoachDb,
  makeInviteCode,
  makeLinkId,
  publicLink,
  toErrorResponse,
  type CoachLinkRow,
} from "../../../coach-links";

export async function POST(request: Request) {
  try {
    const coachId = authenticateCoach(request);
    const db = getCoachDb();
    await ensureCoachSchema(db);

    let label = "";
    try {
      const body = (await request.json()) as { label?: unknown };
      if (typeof body?.label === "string") {
        label = body.label.trim().slice(0, 80);
      }
    } catch {
      /* body is optional */
    }

    const now = new Date().toISOString();

    /* invite_code is UNIQUE; retry a few times rather than 500 on a collision */
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = makeLinkId();
      const code = makeInviteCode();

      try {
        await db
          .prepare(
            `INSERT INTO coach_links (id, coach_id, user_key, client_label, status, invite_code, scope, created_at)
             VALUES (?, ?, NULL, ?, 'pending', ?, 'read', ?)`,
          )
          .bind(id, coachId, label, code, now)
          .run();

        return Response.json({
          id,
          inviteCode: code,
          label,
          status: "pending",
          createdAt: now,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!/UNIQUE/i.test(message) || attempt === 4) {
          throw error;
        }
      }
    }

    throw new Error("Could not allocate an invite code.");
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const coachId = authenticateCoach(request);
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const rows = await db
      .prepare("SELECT * FROM coach_links WHERE coach_id = ? ORDER BY created_at DESC")
      .bind(coachId)
      .all<CoachLinkRow>();

    return Response.json({ links: rows.results.map(publicLink) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
