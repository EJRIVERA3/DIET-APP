import test from "node:test";
import assert from "node:assert/strict";
import { computeCoachTips, computeWeightTrendPerWeek } from "./app/coach.ts";

const ids = (input) => computeCoachTips(input).map((t) => t.id);
const base = {
  calorieTarget: 2000,
  proteinTarget: 0,
  loggedCalories: 1800,
  loggedProtein: 0,
  isFuture: false,
  weighIns: [],
};

test("protein under target fires when food is logged", () => {
  const got = ids({ ...base, proteinTarget: 180, loggedProtein: 30 });
  assert.ok(got.includes("protein-low"));
});

test("protein tip suppressed before any food is logged", () => {
  const got = ids({ ...base, proteinTarget: 180, loggedProtein: 0, loggedCalories: 0 });
  assert.ok(!got.includes("protein-low"));
  assert.deepEqual(got, ["on-track"]);
});

test("protein gap under 5g does not fire", () => {
  const got = ids({ ...base, proteinTarget: 100, loggedProtein: 97 });
  assert.ok(!got.includes("protein-low"));
});

test("low calorie target triggers realism warning", () => {
  assert.ok(ids({ ...base, calorieTarget: 1000 }).includes("cal-target-low"));
  assert.ok(!ids({ ...base, calorieTarget: 1200 }).includes("cal-target-low"));
});

test("significantly under calories fires for a logged, non-future day", () => {
  const got = ids({ ...base, calorieTarget: 2000, loggedCalories: 1000, proteinTarget: 100, loggedProtein: 100 });
  assert.ok(got.includes("cal-under"));
});

test("under-calorie tip suppressed for future days", () => {
  const got = ids({ ...base, calorieTarget: 2000, loggedCalories: 1000, isFuture: true, proteinTarget: 100, loggedProtein: 100 });
  assert.ok(!got.includes("cal-under"));
});

test("fast weight loss fires above 2 lb/week", () => {
  const weighIns = [
    { date: "2026-06-01", weight: 200 },
    { date: "2026-06-08", weight: 196 },
  ];
  assert.ok(ids({ ...base, weighIns }).includes("weight-fast"));
});

test("weight loss within 1% bodyweight/week fires for lighter person", () => {
  const weighIns = [
    { date: "2026-06-01", weight: 120 },
    { date: "2026-06-08", weight: 118.6 }, // 1.4 lb/wk < 2 but > 1% of 120 (=1.2)
  ];
  assert.ok(ids({ ...base, weighIns }).includes("weight-fast"));
});

test("slow steady loss does NOT trigger fast-loss warning", () => {
  const weighIns = [
    { date: "2026-06-01", weight: 200 },
    { date: "2026-06-08", weight: 199.5 }, // 0.5 lb/wk
  ];
  assert.ok(!ids({ ...base, weighIns }).includes("weight-fast"));
});

test("weight trend needs >= 2 entries spanning >= 3 days", () => {
  assert.equal(computeWeightTrendPerWeek([{ date: "2026-06-01", weight: 200 }]), null);
  assert.equal(
    computeWeightTrendPerWeek([
      { date: "2026-06-01", weight: 200 },
      { date: "2026-06-02", weight: 199 },
    ]),
    null,
  );
});

test("on-track message when logged and within targets", () => {
  const got = computeCoachTips({ ...base, proteinTarget: 150, loggedProtein: 150 });
  assert.deepEqual(got.map((t) => t.id), ["on-track"]);
  assert.match(got[0].text, /on target/);
});

test("empty-state message when nothing is logged", () => {
  const tips = computeCoachTips({ ...base, loggedCalories: 0, loggedProtein: 0 });
  assert.equal(tips[0].id, "on-track");
  assert.match(tips[0].text, /Log your meals/);
});

test("multiple rules can stack", () => {
  const weighIns = [
    { date: "2026-06-01", weight: 200 },
    { date: "2026-06-07", weight: 196 },
  ];
  const got = ids({
    calorieTarget: 1000,    // cal-target-low
    proteinTarget: 180,     // protein-low
    loggedCalories: 400,    // cal-under (<700)
    loggedProtein: 30,
    isFuture: false,
    weighIns,               // weight-fast
  });
  assert.ok(got.includes("protein-low"));
  assert.ok(got.includes("cal-target-low"));
  assert.ok(got.includes("cal-under"));
  assert.ok(got.includes("weight-fast"));
});
