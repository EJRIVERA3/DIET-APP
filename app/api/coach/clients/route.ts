/**
 * Coach roster.
 *
 *   GET /api/coach/clients?days=7
 *
 * Two queries regardless of roster size: the coach's active links, then one
 * ranged read of `daily_totals` for those clients. Nothing here touches
 * `daily_logs`, which is why the denormalised table exists.
 *
 * `user_key` is used to join and is then dropped — the response identifies a
 * client only by their link id.
 */
import { computeCoachTips, type CoachWeighIn } from "../../../coach";
import {
  authenticateCoach,
  ensureCoachSchema,
  getCoachDb,
  toErrorResponse,
  type CoachLinkRow,
} from "../../../coach-links";

type TotalsRow = {
  user_key: string;
  day_date: string;
  kcal: number;
  protein: number;
  target_kcal: number;
  target_protein: number;
  weight: number | null;
  meals_logged: number;
  updated_at: string;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const coachId = authenticateCoach(request);
    const db = getCoachDb();
    await ensureCoachSchema(db);

    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("days"));
    const windowDays = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 90) : 7;

    const today = new Date();
    const end = isoDate(today);
    const start = isoDate(new Date(today.getTime() - (windowDays - 1) * 86_400_000));

    const links = await db
      .prepare(
        "SELECT * FROM coach_links WHERE coach_id = ? AND status = 'active' AND user_key IS NOT NULL ORDER BY client_label, created_at",
      )
      .bind(coachId)
      .all<CoachLinkRow>();

    const active = links.results.filter((l): l is CoachLinkRow & { user_key: string } => Boolean(l.user_key));

    if (active.length === 0) {
      return Response.json({ window: { start, end }, clients: [] });
    }

    const placeholders = active.map(() => "?").join(",");
    const totals = await db
      .prepare(
        `SELECT user_key, day_date, kcal, protein, target_kcal, target_protein, weight, meals_logged, updated_at
           FROM daily_totals
          WHERE user_key IN (${placeholders})
            AND day_date BETWEEN ? AND ?
          ORDER BY day_date`,
      )
      .bind(...active.map((l) => l.user_key), start, end)
      .all<TotalsRow>();

    const byUser = new Map<string, TotalsRow[]>();
    for (const row of totals.results) {
      const list = byUser.get(row.user_key) ?? [];
      list.push(row);
      byUser.set(row.user_key, list);
    }

    const clients = active.map((link) => {
      const rows = byUser.get(link.user_key) ?? [];
      const todayRow = rows.find((r) => r.day_date === end) ?? null;
      const logged = rows.filter((r) => r.meals_logged > 0);
      const lastLogged = logged.length ? logged[logged.length - 1] : null;

      const weighIns: CoachWeighIn[] = rows
        .filter((r) => typeof r.weight === "number" && r.weight !== null)
        .map((r) => ({ date: r.day_date, weight: r.weight as number }));

      const tips = computeCoachTips({
        calorieTarget: todayRow?.target_kcal ?? 0,
        proteinTarget: todayRow?.target_protein ?? 0,
        loggedCalories: todayRow?.kcal ?? 0,
        loggedProtein: todayRow?.protein ?? 0,
        isFuture: false,
        weighIns,
      });

      return {
        id: link.id,
        label: link.client_label,
        acceptedAt: link.accepted_at,
        today: todayRow
          ? {
              date: todayRow.day_date,
              kcal: todayRow.kcal,
              protein: todayRow.protein,
              targetKcal: todayRow.target_kcal,
              targetProtein: todayRow.target_protein,
              mealsLogged: todayRow.meals_logged,
            }
          : null,
        /* how many days in the window had anything logged */
        daysLogged: logged.length,
        windowDays,
        lastLoggedDate: lastLogged?.day_date ?? null,
        lastActivityAt: rows.reduce<string | null>(
          (latest, r) => (!latest || r.updated_at > latest ? r.updated_at : latest),
          null,
        ),
        latestWeight: weighIns.length ? weighIns[weighIns.length - 1].weight : null,
        tips,
      };
    });

    return Response.json({ window: { start, end }, clients });
  } catch (error) {
    return toErrorResponse(error);
  }
}
