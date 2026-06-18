// Pure, framework-free coaching rules for the diet tracker.
//
// These are intentionally simple, generic nudges — NOT medical or nutrition
// advice. They are derived only from the user's own targets, logged intake, and
// recent weigh-in trend. Kept in a standalone module so the logic can be unit
// tested directly (see coach.test.ts).

export type CoachTip = {
  id: string;
  tone: "warn" | "suggest" | "good";
  text: string;
};

export type CoachWeighIn = { date: string; weight: number };

export type CoachInput = {
  calorieTarget: number;
  proteinTarget: number;
  loggedCalories: number;
  loggedProtein: number;
  /** True when the viewed day is in the future (suppresses "under intake" tips). */
  isFuture: boolean;
  weighIns: CoachWeighIn[];
};

function toOrdinal(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/**
 * Recent weight-loss rate in lb/week, computed over up to a 14-day window ending
 * at the most recent weigh-in. Returns null when there isn't enough data, and
 * reports 0 loss when the trend is flat or upward.
 */
export function computeWeightTrendPerWeek(
  weighIns: CoachWeighIn[],
): { lossPerWeek: number; startWeight: number } | null {
  const entries = weighIns
    .filter((entry) => typeof entry.weight === "number" && entry.weight > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length < 2) {
    return null;
  }
  const last = entries[entries.length - 1];
  const lastOrd = toOrdinal(last.date);
  const first = entries.find((entry) => lastOrd - toOrdinal(entry.date) <= 14) ?? entries[0];
  const span = lastOrd - toOrdinal(first.date);
  if (span < 3) {
    return null;
  }
  const perWeek = ((last.weight - first.weight) / span) * 7;
  return { lossPerWeek: perWeek < 0 ? -perWeek : 0, startWeight: first.weight };
}

export function computeCoachTips(input: CoachInput): CoachTip[] {
  const { calorieTarget, proteinTarget, loggedCalories, loggedProtein, isFuture, weighIns } = input;
  const tips: CoachTip[] = [];
  const hasLogged = loggedCalories > 0 || loggedProtein > 0;

  // 1. Protein under target (only once some food is logged for the day).
  if (proteinTarget > 0 && hasLogged && loggedProtein < proteinTarget) {
    const remaining = Math.round(proteinTarget - loggedProtein);
    if (remaining >= 5) {
      tips.push({
        id: "protein-low",
        tone: "suggest",
        text: `Protein is under your target today — about ${remaining}g to go. Consider adding Greek yogurt, eggs, chicken, tofu, or beans.`,
      });
    }
  }

  // 2. Calorie target is very low → realism / sustainability nudge.
  if (calorieTarget > 0 && calorieTarget < 1200) {
    tips.push({
      id: "cal-target-low",
      tone: "warn",
      text: `Your daily calorie target (${calorieTarget}) is quite low. Make sure your goal is realistic and sustainable.`,
    });
  }

  // 3. Significantly under calories for a logged, non-future day.
  if (calorieTarget > 0 && hasLogged && !isFuture && loggedCalories < calorieTarget * 0.7) {
    tips.push({
      id: "cal-under",
      tone: "warn",
      text: `You're significantly under your calorie target (${Math.round(loggedCalories)} of ${calorieTarget} cal). If that's not intentional, make sure you're eating enough to stay energized.`,
    });
  }

  // 4. Weight dropping faster than ~2 lb/week (or >1% bodyweight/week).
  const trend = computeWeightTrendPerWeek(weighIns);
  if (trend && (trend.lossPerWeek >= 2 || trend.lossPerWeek >= trend.startWeight * 0.01)) {
    tips.push({
      id: "weight-fast",
      tone: "warn",
      text: `Your weight is trending down about ${trend.lossPerWeek.toFixed(1)} lb/week — that's fairly fast. Consider reviewing your calorie target.`,
    });
  }

  if (tips.length === 0) {
    tips.push({
      id: "on-track",
      tone: "good",
      text: hasLogged
        ? "Nice work — you're tracking on target today."
        : "Log your meals and weigh-ins and coaching tips will show up here.",
    });
  }

  return tips;
}
