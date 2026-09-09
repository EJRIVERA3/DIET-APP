/**
 * Derives a flat, queryable summary from a DayLog payload.
 *
 * `daily_logs.payload` is an opaque JSON blob, so SQL cannot aggregate it.
 * The API writes one `daily_totals` row per day alongside it so the coach
 * roster can be a single indexed query instead of parsing every client's
 * full history.
 *
 * The consumed figures deliberately mirror `getLoggedTotals` in DietApp.tsx:
 * a meal counts only when it actually has foods attached and has not been
 * explicitly excluded from progress. Planned-but-unlogged meals do not count.
 * If that rule changes there, change it here too — `day-totals.test.ts`
 * pins the behaviour.
 *
 * Everything here treats its input as untrusted: payloads arrive straight
 * from a request body.
 */

export type DayTotals = {
  /** Consumed, from logged meals only. */
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** That day's targets, as stored on the DayLog. */
  targetKcal: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  /** Morning weigh-in, or null if not recorded. */
  weight: number | null;
  /** How many meals actually counted. 0 means nothing logged yet. */
  mealsLogged: number;
};

export const EMPTY_DAY_TOTALS: DayTotals = {
  kcal: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  targetKcal: 0,
  targetProtein: 0,
  targetFat: 0,
  targetCarbs: 0,
  weight: null,
  mealsLogged: 0,
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mirrors getLoggedTotals: needs foods, and must not be opted out. */
function mealCounts(meal: unknown): meal is Record<string, unknown> {
  if (!isRecord(meal)) {
    return false;
  }

  if (meal.countsTowardProgress === false) {
    return false;
  }

  return Array.isArray(meal.foods) && meal.foods.length > 0;
}

function readWeight(payload: Record<string, unknown>): number | null {
  const weighIn = payload.weighIn;

  if (!isRecord(weighIn)) {
    return null;
  }

  const raw = weighIn.weight;

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function summarizeDay(payload: unknown): DayTotals {
  if (!isRecord(payload)) {
    return { ...EMPTY_DAY_TOTALS };
  }

  const meals = Array.isArray(payload.meals) ? payload.meals : [];
  const totals = { ...EMPTY_DAY_TOTALS };

  for (const meal of meals) {
    if (!mealCounts(meal)) {
      continue;
    }

    totals.kcal += num(meal.calories);
    totals.protein += num(meal.protein);
    totals.fat += num(meal.fat);
    totals.carbs += num(meal.carbs);
    totals.mealsLogged += 1;
  }

  totals.targetKcal = num(payload.calories);
  totals.targetProtein = num(payload.protein);
  totals.targetFat = num(payload.fat);
  totals.targetCarbs = num(payload.carbs);
  totals.weight = readWeight(payload);

  return totals;
}

/** True when the day has nothing worth showing a coach. */
export function isEmptyDay(totals: DayTotals): boolean {
  return totals.mealsLogged === 0 && totals.weight === null;
}
