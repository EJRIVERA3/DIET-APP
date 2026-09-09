import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDay, isEmptyDay } from "./app/day-totals.ts";

const food = { id: "f1", name: "Chicken", amount: "200g" };

const meal = (over = {}) => ({
  id: "m1",
  name: "Lunch",
  time: "12:30",
  calories: 600,
  protein: 50,
  fat: 20,
  carbs: 45,
  locked: false,
  foods: [food],
  ...over,
});

const day = (over = {}) => ({
  date: "2026-06-01",
  calories: 2000,
  protein: 180,
  fat: 60,
  carbs: 200,
  stepMin: 8000,
  stepMax: 12000,
  weighIn: { time: "07:00", weight: 198.4 },
  meals: [meal()],
  workouts: [],
  busyBlocks: [],
  ...over,
});

test("sums logged meals into consumed totals", () => {
  const t = summarizeDay(day({ meals: [meal(), meal({ id: "m2", calories: 400, protein: 30, fat: 10, carbs: 40 })] }));
  assert.equal(t.kcal, 1000);
  assert.equal(t.protein, 80);
  assert.equal(t.fat, 30);
  assert.equal(t.carbs, 85);
  assert.equal(t.mealsLogged, 2);
});

test("targets come from the day, not from the meals", () => {
  const t = summarizeDay(day());
  assert.equal(t.targetKcal, 2000);
  assert.equal(t.targetProtein, 180);
  assert.equal(t.targetFat, 60);
  assert.equal(t.targetCarbs, 200);
});

test("a planned meal with no foods does not count as logged", () => {
  const t = summarizeDay(day({ meals: [meal({ foods: [] })] }));
  assert.equal(t.kcal, 0);
  assert.equal(t.mealsLogged, 0);
});

test("countsTowardProgress false excludes the meal", () => {
  const t = summarizeDay(day({ meals: [meal({ countsTowardProgress: false })] }));
  assert.equal(t.kcal, 0);
  assert.equal(t.mealsLogged, 0);
});

test("countsTowardProgress true or undefined still counts", () => {
  assert.equal(summarizeDay(day({ meals: [meal({ countsTowardProgress: true })] })).mealsLogged, 1);
  assert.equal(summarizeDay(day({ meals: [meal({ countsTowardProgress: undefined })] })).mealsLogged, 1);
});

test("reads the weigh-in, and null when not recorded", () => {
  assert.equal(summarizeDay(day()).weight, 198.4);
  assert.equal(summarizeDay(day({ weighIn: { time: "07:00", weight: null } })).weight, null);
  assert.equal(summarizeDay(day({ weighIn: undefined })).weight, null);
});

test("survives junk payloads without throwing", () => {
  for (const junk of [null, undefined, 42, "nope", [], {}]) {
    const t = summarizeDay(junk);
    assert.equal(t.kcal, 0);
    assert.equal(t.mealsLogged, 0);
    assert.equal(t.weight, null);
  }
});

test("non-numeric macros are treated as zero, not NaN", () => {
  const t = summarizeDay(day({ meals: [meal({ calories: "abc", protein: null, fat: undefined, carbs: {} })] }));
  assert.equal(t.kcal, 0);
  assert.equal(t.protein, 0);
  assert.equal(t.fat, 0);
  assert.equal(t.carbs, 0);
  assert.equal(t.mealsLogged, 1, "the meal still counts - it has foods");
});

test("meals that are not objects are skipped", () => {
  const t = summarizeDay(day({ meals: [null, "x", 7, meal()] }));
  assert.equal(t.mealsLogged, 1);
  assert.equal(t.kcal, 600);
});

test("isEmptyDay only when nothing logged and no weigh-in", () => {
  assert.equal(isEmptyDay(summarizeDay(day({ meals: [meal({ foods: [] })], weighIn: { time: "", weight: null } }))), true);
  assert.equal(isEmptyDay(summarizeDay(day({ meals: [meal({ foods: [] })] }))), false, "weigh-in alone is worth showing");
  assert.equal(isEmptyDay(summarizeDay(day())), false);
});
