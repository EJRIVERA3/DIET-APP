"use client";

import {
  ArrowLeft,
  Ban,
  Box,
  CalendarDays,
  CalendarX,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock,
  Copy,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Info,
  LayoutGrid,
  LineChart,
  LockKeyhole,
  Map,
  Menu,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Settings,
  Share2,
  Target,
  UnlockKeyhole,
  Utensils,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "schedule" | "progress" | "explore" | "more";
type Sheet = "actions" | "meal" | "copy" | "advanced" | "cloud" | "weighin" | "calendar" | "adjust" | null;
type FullScreen = "workout" | "busy" | "edit" | null;

type Profile = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  stepMin: number;
  stepMax: number;
  startDate: string;
  startWeight: number;
  goalWeight: number;
  goalDate: string;
};

type Food = {
  id: string;
  name: string;
  amount: string;
};

type Meal = {
  id: string;
  name: string;
  time: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  locked: boolean;
  foods: Food[];
};

type Workout = {
  id: string;
  type: string;
  startTime: string;
  duration: string;
  intensity: string;
  shake: boolean;
  optimize: boolean;
  updateTargets: boolean;
};

type BusyBlock = {
  id: string;
  startTime: string;
  endTime: string;
  optimize: boolean;
};

type WeighIn = {
  time: string;
  weight: number | null;
};

type DayLog = {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  stepMin: number;
  stepMax: number;
  weighIn: WeighIn;
  meals: Meal[];
  workouts: Workout[];
  busyBlocks: BusyBlock[];
};

type Totals = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

type MealDraft = {
  id: string | null;
  name: string;
  time: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  locked: boolean;
  foodName: string;
  foodAmount: string;
};

type CopyOptions = {
  activity: boolean;
  firstLast: boolean;
  mealCount: boolean;
  meals: boolean;
  mealTargets: boolean;
  mealFoods: boolean;
  lockedMeals: boolean;
  workouts: boolean;
  busy: boolean;
};

type AdjustedMeal = Meal & {
  adjustedCalories: number;
  adjustedProtein: number;
  adjustedFat: number;
  adjustedCarbs: number;
};

const USER_KEY_RE = /^[A-Za-z0-9_-]{24,128}$/;
const SYNC_KEY_STORAGE = "daily-diet-cloud.sync-key";
const APP_STATE_PREFIX = "daily-diet-cloud.state.";
const BOOT_DATE = "2026-06-13";

const EMPTY_TOTALS: Totals = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
};

const DEFAULT_COPY_OPTIONS: CopyOptions = {
  activity: true,
  firstLast: true,
  mealCount: true,
  meals: true,
  mealTargets: true,
  mealFoods: true,
  lockedMeals: true,
  workouts: true,
  busy: true,
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, amount: number) {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

function weekStart(value: string) {
  const date = parseDateKey(value);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return dateKey(date);
}

function dateOrdinal(value: string) {
  const date = parseDateKey(value);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

function daysBetween(start: string, end: string) {
  return Math.round(dateOrdinal(end) - dateOrdinal(start));
}

function dietWeekNumber(value: string, startDate: string) {
  return Math.max(1, Math.floor(daysBetween(weekStart(startDate), weekStart(value)) / 7) + 1);
}

function weekStartForNumber(startDate: string, weekNumber: number) {
  return addDays(weekStart(startDate), (weekNumber - 1) * 7);
}

function sameDay(a: string, b: string) {
  return a === b;
}

function formatHeaderTitle(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseDateKey(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateKey(value));
}

function formatSheetDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  })
    .format(parseDateKey(value))
    .toUpperCase();
}

function formatGoalDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateKey(value));
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function makeSyncKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDefaultProfile(today: string): Profile {
  return {
    calories: 1900,
    protein: 160,
    fat: 60,
    carbs: 180,
    stepMin: 8000,
    stepMax: 13000,
    startDate: addDays(today, -2),
    startWeight: 233,
    goalWeight: 220,
    goalDate: addDays(today, 54),
  };
}

function plannedMeals(sample = false, date = "default"): Meal[] {
  const base = [
    {
      name: "Meal 1",
      time: "9:00 AM",
      calories: sample ? 275 : 475,
      protein: sample ? 5 : 40,
      fat: 15,
      carbs: sample ? 30 : 45,
      foods: sample
        ? [{ id: makeId("food"), name: "Cheese Danish", amount: "(ABOUT 1 PIECE) 80 G" }]
        : [],
    },
    { name: "Meal 2", time: "1:00 PM", calories: 475, protein: 40, fat: 15, carbs: 45, foods: [] },
    { name: "Meal 3", time: "5:00 PM", calories: 475, protein: 40, fat: 15, carbs: 45, foods: [] },
    { name: "Meal 4", time: "8:30 PM", calories: 475, protein: 40, fat: 15, carbs: 45, foods: [] },
  ];

  return base.map((meal) => ({
    id: `meal-${date}-${meal.name.toLowerCase().replaceAll(" ", "-")}`,
    name: meal.name,
    time: meal.time,
    calories: meal.calories,
    protein: meal.protein,
    fat: meal.fat,
    carbs: meal.carbs,
    locked: false,
    foods: meal.foods.map((food, index) => ({
      ...food,
      id: `food-${date}-${index + 1}`,
    })),
  }));
}

function createDay(value: string, profile: Profile, sample = false): DayLog {
  return {
    date: value,
    calories: profile.calories,
    protein: profile.protein,
    fat: profile.fat,
    carbs: profile.carbs,
    stepMin: profile.stepMin,
    stepMax: profile.stepMax,
    weighIn: {
      time: "8:30 AM",
      weight: null,
    },
    meals: plannedMeals(sample, value),
    workouts: [],
    busyBlocks: [],
  };
}

function seedDays(today: string, profile: Profile) {
  const start = weekStart(today);
  const seeded: Record<string, DayLog> = {};

  for (let index = 0; index < 7; index += 1) {
    const value = addDays(start, index);
    seeded[value] = createDay(value, profile, sameDay(value, today));
  }

  return seeded;
}

function normalizeProfile(value: unknown, today: string): Profile {
  const defaults = createDefaultProfile(today);
  const source = value && typeof value === "object" ? (value as Partial<Profile>) : {};

  return {
    calories: Number(source.calories ?? defaults.calories),
    protein: Number(source.protein ?? defaults.protein),
    fat: Number(source.fat ?? defaults.fat),
    carbs: Number(source.carbs ?? defaults.carbs),
    stepMin: Number(source.stepMin ?? defaults.stepMin),
    stepMax: Number(source.stepMax ?? defaults.stepMax),
    startDate: typeof source.startDate === "string" ? source.startDate : defaults.startDate,
    startWeight: Number(source.startWeight ?? defaults.startWeight),
    goalWeight: Number(source.goalWeight ?? defaults.goalWeight),
    goalDate: typeof source.goalDate === "string" ? source.goalDate : defaults.goalDate,
  };
}

function normalizeDay(value: unknown, date: string, profile: Profile): DayLog {
  const defaults = createDay(date, profile);
  const source = value && typeof value === "object" ? (value as Partial<DayLog>) : {};
  const meals = Array.isArray(source.meals) ? source.meals : defaults.meals;
  const workouts = Array.isArray(source.workouts) ? source.workouts : [];
  const busyBlocks = Array.isArray(source.busyBlocks) ? source.busyBlocks : [];
  const weighIn = source.weighIn && typeof source.weighIn === "object" ? source.weighIn : defaults.weighIn;

  return {
    date,
    calories: Number(source.calories ?? defaults.calories),
    protein: Number(source.protein ?? defaults.protein),
    fat: Number(source.fat ?? defaults.fat),
    carbs: Number(source.carbs ?? defaults.carbs),
    stepMin: Number(source.stepMin ?? defaults.stepMin),
    stepMax: Number(source.stepMax ?? defaults.stepMax),
    weighIn: {
      time: typeof weighIn.time === "string" ? weighIn.time : "8:30 AM",
      weight: weighIn.weight === null || weighIn.weight === undefined ? null : Number(weighIn.weight),
    },
    meals: meals.map((meal, index) => ({
      id: meal.id ?? makeId("meal"),
      name: meal.name ?? `Meal ${index + 1}`,
      time: meal.time ?? "12:00 PM",
      calories: Number(meal.calories ?? 0),
      protein: Number(meal.protein ?? 0),
      fat: Number(meal.fat ?? 0),
      carbs: Number(meal.carbs ?? 0),
      locked: Boolean(meal.locked),
      foods: Array.isArray(meal.foods)
        ? meal.foods.map((food) => ({
            id: food.id ?? makeId("food"),
            name: food.name ?? "Food",
            amount: food.amount ?? "",
          }))
        : [],
    })),
    workouts: workouts.map((workout) => ({
      id: workout.id ?? makeId("workout"),
      type: workout.type ?? "weight training",
      startTime: workout.startTime ?? "12:00 PM",
      duration: workout.duration ?? "1h",
      intensity: workout.intensity ?? "light",
      shake: Boolean(workout.shake),
      optimize: Boolean(workout.optimize),
      updateTargets: Boolean(workout.updateTargets),
    })),
    busyBlocks: busyBlocks.map((block) => ({
      id: block.id ?? makeId("busy"),
      startTime: block.startTime ?? "12:00 PM",
      endTime: block.endTime ?? "1:00 PM",
      optimize: Boolean(block.optimize),
    })),
  };
}

function getTotals(day: DayLog | null | undefined): Totals {
  if (!day) {
    return EMPTY_TOTALS;
  }

  return day.meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + Number(meal.calories || 0),
      protein: totals.protein + Number(meal.protein || 0),
      fat: totals.fat + Number(meal.fat || 0),
      carbs: totals.carbs + Number(meal.carbs || 0),
    }),
    EMPTY_TOTALS,
  );
}

function clamp(value: number, min = 0) {
  return Number.isFinite(value) ? Math.max(min, Math.round(value)) : min;
}

function distributeValue(total: number, count: number, index: number) {
  if (count <= 0) {
    return 0;
  }

  const safeTotal = clamp(total);
  const base = Math.floor(safeTotal / count);
  const remainder = safeTotal - base * count;
  return base + (index < remainder ? 1 : 0);
}

function underText(value: number, unit = "") {
  if (value > 0) {
    return `${value}${unit} under`;
  }

  if (value < 0) {
    return `${Math.abs(value)}${unit} over`;
  }

  return "on target";
}

function percent(value: number, target: number) {
  if (!target) {
    return 0;
  }

  return Math.min(100, Math.max(3, (value / target) * 100));
}

function cloneDay(day: DayLog): DayLog {
  return JSON.parse(JSON.stringify(day)) as DayLog;
}

function IconLabel({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <>
      <Icon size={26} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </>
  );
}

function MacroBadge({
  kind,
  children,
}: {
  kind: "cal" | "protein" | "fat" | "carbs";
  children: React.ReactNode;
}) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

function MiniBadge({
  kind,
  children,
}: {
  kind: "cal" | "protein" | "fat" | "carbs";
  children: React.ReactNode;
}) {
  return <span className={`mini-badge ${kind}`}>{children}</span>;
}

export default function DietApp() {
  const [today, setToday] = useState(BOOT_DATE);
  const [selectedDate, setSelectedDate] = useState(BOOT_DATE);
  const [profile, setProfile] = useState<Profile>(() => createDefaultProfile(BOOT_DATE));
  const [days, setDays] = useState<Record<string, DayLog>>(() =>
    seedDays(BOOT_DATE, createDefaultProfile(BOOT_DATE)),
  );
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [fullScreen, setFullScreen] = useState<FullScreen>(null);
  const [syncKey, setSyncKey] = useState("");
  const [restoreKey, setRestoreKey] = useState("");
  const [syncStatus, setSyncStatus] = useState("Starting cloud backup");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [mealDraft, setMealDraft] = useState<MealDraft>(() => newMealDraft());
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [copyOptions, setCopyOptions] = useState<CopyOptions>(DEFAULT_COPY_OPTIONS);
  const [workoutDraft, setWorkoutDraft] = useState<Workout>(() => newWorkout());
  const [busyDraft, setBusyDraft] = useState<BusyBlock>(() => newBusyBlock());
  const [weighDraft, setWeighDraft] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(BOOT_DATE);
  const [adjustSelectedMealIds, setAdjustSelectedMealIds] = useState<string[]>([]);
  const [adjustReset, setAdjustReset] = useState(false);
  const [weekMenuOpen, setWeekMenuOpen] = useState(false);
  const saveTouchedRef = useRef(false);

  const currentDay = days[selectedDate] ?? createDay(selectedDate, profile, sameDay(selectedDate, today));
  const totals = useMemo(() => getTotals(currentDay), [currentDay]);
  const calorieDelta = currentDay.calories - totals.calories;
  const proteinDelta = currentDay.protein - totals.protein;
  const currentWeekNumber = dietWeekNumber(selectedDate, profile.startDate);
  const weekOptions = useMemo(() => {
    const finalWeek = Math.max(
      2,
      dietWeekNumber(selectedDate, profile.startDate),
      dietWeekNumber(today, profile.startDate) + 1,
    );

    return Array.from({ length: finalWeek }, (_, index) => {
      const number = index + 1;
      const start = weekStartForNumber(profile.startDate, number);

      return {
        number,
        start,
        end: addDays(start, 6),
      };
    });
  }, [profile.startDate, selectedDate, today]);
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const localToday = dateKey(new Date());
      const storedKey = localStorage.getItem(SYNC_KEY_STORAGE);
      const nextKey = storedKey && USER_KEY_RE.test(storedKey) ? storedKey : makeSyncKey();
      localStorage.setItem(SYNC_KEY_STORAGE, nextKey);
      const cached = readCachedState(nextKey, localToday);

      await Promise.resolve();

      if (cancelled) {
        return;
      }

      setToday(localToday);
      setSelectedDate((current) => (current === BOOT_DATE ? localToday : current));
      setSyncKey(nextKey);
      if (cached) {
        setProfile(cached.profile);
        setDays(cached.days);
      }

      void loadCloudKey(nextKey, cached, localToday);
    }

    void boot();

    return () => {
      cancelled = true;
    };
    // The first load is intentionally controlled here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!booted || !syncKey) {
      return;
    }

    localStorage.setItem(`${APP_STATE_PREFIX}${syncKey}`, JSON.stringify({ profile, days }));
    setSyncStatus(saveTouchedRef.current ? "Saving to cloud" : "Cloud backup active");

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/diet", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKey: syncKey, profile, days }),
        });

        if (!response.ok) {
          throw new Error("Cloud save failed");
        }

        setLastSync(new Date().toISOString());
        setSyncStatus("Cloud backup active");
        saveTouchedRef.current = false;
      } catch {
        setSyncStatus("Cloud backup waiting for connection");
      }
    }, saveTouchedRef.current ? 650 : 1200);

    return () => window.clearTimeout(timer);
  }, [booted, days, profile, syncKey]);

  async function loadCloudKey(
    key: string,
    cached: { profile: Profile; days: Record<string, DayLog> } | null = null,
    baseToday = today,
  ) {
    setSyncStatus("Restoring from cloud");

    try {
      const response = await fetch(`/api/diet?userKey=${encodeURIComponent(key)}`);
      if (!response.ok) {
        throw new Error("Cloud restore failed");
      }

      const payload = (await response.json()) as {
        profile: unknown;
        days: Array<{ date: string; payload: unknown }>;
      };
      const nextProfile = payload.profile ? normalizeProfile(payload.profile, baseToday) : cached?.profile ?? profile;
      const nextDays: Record<string, DayLog> = {};

      for (const row of payload.days ?? []) {
        if (row.date) {
          nextDays[row.date] = normalizeDay(row.payload, row.date, nextProfile);
        }
      }

      const hasRemoteDays = Object.keys(nextDays).length > 0;
      const finalDays = hasRemoteDays ? nextDays : cached?.days ?? seedDays(baseToday, nextProfile);

      setProfile(nextProfile);
      setDays(finalDays);
      setLastSync(new Date().toISOString());
      setSyncStatus("Cloud backup active");
      setBooted(true);
    } catch {
      if (cached) {
        setProfile(cached.profile);
        setDays(cached.days);
      }
      setSyncStatus("Cloud backup waiting for connection");
      setBooted(true);
    }
  }

  function readCachedState(key: string, baseToday = today) {
    const cached = localStorage.getItem(`${APP_STATE_PREFIX}${key}`);
    if (!cached) {
      return null;
    }

    try {
      const parsed = JSON.parse(cached) as { profile: unknown; days: Record<string, unknown> };
      const cachedProfile = normalizeProfile(parsed.profile, baseToday);
      const cachedDays = Object.fromEntries(
        Object.entries(parsed.days ?? {}).map(([value, day]) => [
          value,
          normalizeDay(day, value, cachedProfile),
        ]),
      );

      return {
        profile: cachedProfile,
        days: cachedDays,
      };
    } catch {
      return null;
    }
  }

  function touch() {
    saveTouchedRef.current = true;
  }

  function updateDay(value: string, updater: (day: DayLog) => DayLog) {
    touch();
    setDays((current) => {
      const base = current[value] ?? createDay(value, profile, sameDay(value, today));
      return {
        ...current,
        [value]: updater(cloneDay(base)),
      };
    });
  }

  function updateProfile(next: Partial<Profile>) {
    touch();
    setProfile((current) => ({ ...current, ...next }));
  }

  function chooseDate(value: string) {
    setSelectedDate(value);
    setDays((current) => {
      if (current[value]) {
        return current;
      }

      touch();
      return {
        ...current,
        [value]: createDay(value, profile, sameDay(value, today)),
      };
    });
  }

  function chooseWeek(weekNumber: number) {
    const targetStart = weekStartForNumber(profile.startDate, weekNumber);
    const weekdayOffset = Math.max(0, Math.min(6, daysBetween(weekStart(selectedDate), selectedDate)));
    chooseDate(addDays(targetStart, weekdayOffset));
    setWeekMenuOpen(false);
  }

  function openCalendar() {
    setWeekMenuOpen(false);
    setCalendarMonth(selectedDate);
    setSheet("calendar");
  }

  function openAdjustMeals() {
    setWeekMenuOpen(false);
    const unlockedMeals = currentDay.meals.filter((meal) => !meal.locked && meal.foods.length === 0);
    setAdjustSelectedMealIds((unlockedMeals.length ? unlockedMeals : currentDay.meals).map((meal) => meal.id));
    setAdjustReset(false);
    setSheet("adjust");
  }

  function openNewMeal() {
    setWeekMenuOpen(false);
    setMealDraft(newMealDraft(currentDay.meals.length + 1));
    setSheet("meal");
  }

  function openMeal(meal: Meal) {
    setWeekMenuOpen(false);
    setMealDraft({
      id: meal.id,
      name: meal.name,
      time: meal.time,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      locked: meal.locked,
      foodName: meal.foods[0]?.name ?? "",
      foodAmount: meal.foods[0]?.amount ?? "",
    });
    setSheet("meal");
  }

  function saveMeal() {
    const meal: Meal = {
      id: mealDraft.id ?? makeId("meal"),
      name: mealDraft.name.trim() || `Meal ${currentDay.meals.length + 1}`,
      time: mealDraft.time.trim() || "12:00 PM",
      calories: clamp(mealDraft.calories),
      protein: clamp(mealDraft.protein),
      fat: clamp(mealDraft.fat),
      carbs: clamp(mealDraft.carbs),
      locked: mealDraft.locked,
      foods:
        mealDraft.foodName.trim().length > 0
          ? [
              {
                id: makeId("food"),
                name: mealDraft.foodName.trim(),
                amount: mealDraft.foodAmount.trim(),
              },
            ]
          : [],
    };

    updateDay(selectedDate, (day) => ({
      ...day,
      meals: mealDraft.id
        ? day.meals.map((item) => (item.id === mealDraft.id ? meal : item))
        : [...day.meals, meal],
    }));
    setSheet(null);
  }

  function deleteMeal(id: string | null) {
    if (!id) {
      setSheet(null);
      return;
    }

    updateDay(selectedDate, (day) => ({
      ...day,
      meals: day.meals.filter((meal) => meal.id !== id),
    }));
    setSheet(null);
  }

  function saveWorkout() {
    updateDay(selectedDate, (day) => {
      const calories = workoutDraft.updateTargets ? day.calories + 180 : day.calories;
      return {
        ...day,
        calories,
        workouts: [...day.workouts, { ...workoutDraft, id: makeId("workout") }],
      };
    });
    setFullScreen(null);
  }

  function saveBusy() {
    updateDay(selectedDate, (day) => ({
      ...day,
      busyBlocks: [...day.busyBlocks, { ...busyDraft, id: makeId("busy") }],
    }));
    setFullScreen(null);
  }

  function saveWeighIn() {
    updateDay(selectedDate, (day) => ({
      ...day,
      weighIn: {
        ...day.weighIn,
        weight: weighDraft.trim() ? Number(weighDraft) : null,
      },
    }));
    setSheet(null);
  }

  function getAdjustedMeals(day = currentDay): AdjustedMeal[] {
    const selectedIds = new Set(adjustReset ? day.meals.map((meal) => meal.id) : adjustSelectedMealIds);
    const selectedMeals = day.meals.filter((meal) => selectedIds.has(meal.id));
    const fixedMeals = day.meals.filter((meal) => !selectedIds.has(meal.id));
    const fixedTotals = getTotals({
      ...day,
      meals: fixedMeals,
    });

    const remaining = {
      calories: Math.max(0, day.calories - fixedTotals.calories),
      protein: Math.max(0, day.protein - fixedTotals.protein),
      fat: Math.max(0, day.fat - fixedTotals.fat),
      carbs: Math.max(0, day.carbs - fixedTotals.carbs),
    };

    let selectedIndex = 0;

    return day.meals.map((meal) => {
      if (!selectedIds.has(meal.id)) {
        return {
          ...meal,
          adjustedCalories: meal.calories,
          adjustedProtein: meal.protein,
          adjustedFat: meal.fat,
          adjustedCarbs: meal.carbs,
        };
      }

      const index = selectedIndex;
      selectedIndex += 1;

      return {
        ...meal,
        adjustedCalories: distributeValue(remaining.calories, selectedMeals.length, index),
        adjustedProtein: distributeValue(remaining.protein, selectedMeals.length, index),
        adjustedFat: distributeValue(remaining.fat, selectedMeals.length, index),
        adjustedCarbs: distributeValue(remaining.carbs, selectedMeals.length, index),
      };
    });
  }

  function getAdjustedTotals(adjustedMeals = getAdjustedMeals()) {
    return adjustedMeals.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.adjustedCalories,
        protein: sum.protein + meal.adjustedProtein,
        fat: sum.fat + meal.adjustedFat,
        carbs: sum.carbs + meal.adjustedCarbs,
      }),
      EMPTY_TOTALS,
    );
  }

  function saveAdjustedMeals() {
    const selectedIds = new Set(
      adjustReset ? currentDay.meals.map((meal) => meal.id) : adjustSelectedMealIds,
    );
    const adjustedMeals = getAdjustedMeals();

    updateDay(selectedDate, (day) => ({
      ...day,
      meals: day.meals.map((meal) => {
        const adjusted = adjustedMeals.find((item) => item.id === meal.id);
        if (!adjusted || !selectedIds.has(meal.id)) {
          return meal;
        }

        return {
          ...meal,
          calories: adjusted.adjustedCalories,
          protein: adjusted.adjustedProtein,
          fat: adjusted.adjustedFat,
          carbs: adjusted.adjustedCarbs,
        };
      }),
    }));
    setSheet(null);
  }

  function openCopyDay() {
    const targets = Array.from({ length: 10 }, (_, index) => addDays(selectedDate, index - 2)).filter(
      (value) => value !== selectedDate,
    );
    setCopyTargets(targets.slice(2, 5));
    setSheet("copy");
  }

  function applyCopyDay() {
    const source = cloneDay(currentDay);
    touch();
    setDays((current) => {
      const next = { ...current };

      for (const target of copyTargets) {
        const fallback = next[target] ?? createDay(target, profile);
        const copied = cloneDay(source);
        copied.date = target;

        if (!copyOptions.activity) {
          copied.stepMin = fallback.stepMin;
          copied.stepMax = fallback.stepMax;
        }

        if (!copyOptions.meals) {
          copied.meals = fallback.meals;
        } else {
          copied.meals = copied.meals.map((meal, index) => ({
            ...meal,
            id: makeId("meal"),
            name: copyOptions.mealCount ? meal.name : `Meal ${index + 1}`,
            calories: copyOptions.mealTargets ? meal.calories : fallback.meals[index]?.calories ?? meal.calories,
            protein: copyOptions.mealTargets ? meal.protein : fallback.meals[index]?.protein ?? meal.protein,
            fat: copyOptions.mealTargets ? meal.fat : fallback.meals[index]?.fat ?? meal.fat,
            carbs: copyOptions.mealTargets ? meal.carbs : fallback.meals[index]?.carbs ?? meal.carbs,
            foods: copyOptions.mealFoods
              ? meal.foods.map((food) => ({ ...food, id: makeId("food") }))
              : [],
            locked: copyOptions.lockedMeals ? meal.locked : false,
          }));
        }

        if (!copyOptions.workouts) {
          copied.workouts = [];
        }

        if (!copyOptions.busy) {
          copied.busyBlocks = [];
        }

        next[target] = copied;
      }

      return next;
    });
    setSheet(null);
  }

  function toggleCopyTarget(value: string) {
    setCopyTargets((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function addLibraryMeal(name: string, macros: Totals) {
    const nextMeal: Meal = {
      id: makeId("meal"),
      name: `Meal ${currentDay.meals.length + 1}`,
      time: "7:45 PM",
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
      locked: false,
      foods: [{ id: makeId("food"), name, amount: "1 serving" }],
    };

    updateDay(selectedDate, (day) => ({
      ...day,
      meals: [...day.meals, nextMeal],
    }));
    setActiveTab("schedule");
  }

  async function copySyncKey() {
    try {
      await navigator.clipboard.writeText(syncKey);
      setSyncStatus("Sync key copied");
    } catch {
      setSyncStatus("Copy unavailable");
    }
  }

  function restoreCloudKey() {
    const nextKey = restoreKey.trim();
    if (!USER_KEY_RE.test(nextKey)) {
      setSyncStatus("Enter a valid sync key");
      return;
    }

    localStorage.setItem(SYNC_KEY_STORAGE, nextKey);
    setSyncKey(nextKey);
    setBooted(false);
    setSheet(null);
    void loadCloudKey(nextKey, readCachedState(nextKey), today);
  }

  function renderBody() {
    if (fullScreen === "workout") {
      return renderWorkoutScreen();
    }

    if (fullScreen === "busy") {
      return renderBusyScreen();
    }

    if (fullScreen === "edit") {
      return renderEditSchedule();
    }

    return (
      <main className="app-main">
        {activeTab === "schedule" && renderSchedule()}
        {activeTab === "progress" && renderProgress()}
        {activeTab === "explore" && renderExplore()}
        {activeTab === "more" && renderMore()}
      </main>
    );
  }

  function renderSchedule() {
    return (
      <>
        <div className="topbar">
          {renderWeekPill()}
          <h1 className="screen-title">{formatHeaderTitle(selectedDate)}</h1>
          <div className="icon-row">
            <button className="icon-button flat" onClick={openCalendar} title="Pick a date">
              <CalendarDays size={26} />
            </button>
            <button
              className="icon-button flat"
              onClick={() => {
                setWeekMenuOpen(false);
                setFullScreen("edit");
              }}
              title="Edit schedule"
            >
              <LayoutGrid size={26} />
            </button>
            <button className="icon-button flat" onClick={() => setSheet("actions")} title="Actions">
              <Menu size={28} />
            </button>
          </div>
        </div>

        {renderWeekStrip()}
        {renderMacroGrid(currentDay, totals)}

        <div className="step-row header-row">
          <span className="label-strong header-row" style={{ gap: 8 }}>
            <Footprints size={22} /> Step count target
          </span>
          <strong className="mono">
            {Math.round(currentDay.stepMin / 1000)} - {Math.round(currentDay.stepMax / 1000)}k
          </strong>
        </div>

        {calorieDelta !== 0 && (
          <div className="notice">
            <Info size={24} color="#2c95b8" />
            <p>
              Your day target is {currentDay.calories} cal, but your meals total {totals.calories}.
            </p>
            <button className="icon-button flat" onClick={() => null} title="Dismiss">
              <X size={22} />
            </button>
          </div>
        )}

        <div className="schedule-list">
          {renderWeighInCard()}
          {currentDay.meals.map((meal) => renderMealCard(meal))}
          {currentDay.workouts.map((workout) => (
            <article className="card disabled-card" key={workout.id}>
              <div className="split-row" style={{ justifyContent: "space-between" }}>
                <strong className="meal-title">
                  <Dumbbell size={24} /> {workout.type}
                </strong>
                <span className="time-pill">{workout.startTime}</span>
              </div>
            </article>
          ))}
          {currentDay.busyBlocks.map((block) => (
            <article className="card disabled-card" key={block.id}>
              <div className="split-row" style={{ justifyContent: "space-between" }}>
                <strong className="meal-title">
                  <Clock size={24} /> Busy
                </strong>
                <span className="time-pill">
                  {block.startTime} - {block.endTime}
                </span>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  function renderWeekPill() {
    return (
      <button
        className="week-pill"
        type="button"
        aria-expanded={weekMenuOpen}
        aria-haspopup="menu"
        onClick={() => setWeekMenuOpen((open) => !open)}
        title="Choose week"
      >
        Week <span>{currentWeekNumber}</span>
      </button>
    );
  }

  function renderWeekMenu() {
    if (!weekMenuOpen) {
      return null;
    }

    return (
      <>
        <button className="week-menu-backdrop" aria-label="Close week picker" onClick={() => setWeekMenuOpen(false)} />
        <div className="week-menu" role="menu" aria-label="Choose week">
          {weekOptions.map((week) => {
            const active = week.number === currentWeekNumber;

            return (
              <button
                className="week-menu-item"
                key={week.number}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => chooseWeek(week.number)}
              >
                <span>Week {week.number}</span>
                {active && <Check size={28} strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderWeekStrip() {
    const start = weekStart(selectedDate);

    return (
      <div className="week-strip">
        {Array.from({ length: 7 }, (_, index) => {
          const value = addDays(start, index);
          const date = parseDateKey(value);
          const day = days[value];
          const dayTotals = getTotals(day);
          const beforeStart = value < profile.startDate;
          const target = day?.calories ?? profile.calories;
          const isUnder = Boolean(day && target - dayTotals.calories > 0 && !beforeStart);

          return (
            <button
              className={`day-chip ${sameDay(value, selectedDate) ? "active" : ""} ${
                sameDay(value, today) ? "today" : ""
              }`}
              key={value}
          onClick={() => chooseDate(value)}
            >
              <span className="day-letter">
                {new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date)}
              </span>
              <span className="date-dot">
                {date.getDate()}
                {isUnder && <span className="warn-dot" />}
              </span>
              <span className="day-target">{beforeStart ? "-" : target}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderMacroGrid(day: DayLog, dayTotals: Totals) {
    const items = [
      { key: "calories", label: "Cal", value: dayTotals.calories, target: day.calories, color: "cal" as const, text: <Flame size={16} /> },
      { key: "protein", label: "P", value: dayTotals.protein, target: day.protein, color: "protein" as const, text: "P" },
      { key: "fat", label: "F", value: dayTotals.fat, target: day.fat, color: "fat" as const, text: "F" },
      { key: "carbs", label: "C", value: dayTotals.carbs, target: day.carbs, color: "carbs" as const, text: "C" },
    ];

    return (
      <div className="macro-grid">
        {items.map((item) => (
          <div className="macro-meter" key={item.key}>
            <div className="meter-track" title={item.label}>
              <div
                className={`meter-fill ${item.color}`}
                style={{ width: `${percent(item.value, item.target)}%` }}
              />
            </div>
            <div className="meter-label">
              <MiniBadge kind={item.color}>{item.text}</MiniBadge>
              {item.value}/{item.target}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderWeighInCard() {
    return (
      <button
        className="card disabled-card"
        style={{ textAlign: "left" }}
        onClick={() => {
          setWeighDraft(currentDay.weighIn.weight?.toString() ?? "");
          setSheet("weighin");
        }}
      >
        <div className="split-row" style={{ justifyContent: "space-between" }}>
          <strong className="meal-title">
            <Gauge size={24} /> Weigh-in
          </strong>
          <span className="time-pill">{currentDay.weighIn.weight ?? currentDay.weighIn.time}</span>
        </div>
      </button>
    );
  }

  function renderMealCard(meal: Meal) {
    const under = meal.calories < 420 || meal.protein < 25;

    return (
      <article className="card" key={meal.id}>
        <button
          className="meal-card-head"
          style={{ background: "#ffffff", border: 0, textAlign: "left", width: "100%" }}
          onClick={() => openMeal(meal)}
        >
          <div className="meal-title">
            <Utensils size={25} />
            <span className="meal-name">{meal.name}</span>
            {under && <span className="target-pill">1 food - Under targets</span>}
          </div>
          <span className="time-pill">{meal.time}</span>
        </button>
        <div className="meal-macros">
          <div className="macro-value">
            <MacroBadge kind="cal">
              <Flame size={16} />
            </MacroBadge>
            <strong>{meal.calories}</strong>
          </div>
          <div className="macro-value">
            <MacroBadge kind="protein">P</MacroBadge>
            <strong>{meal.protein}</strong>
          </div>
          <div className="macro-value">
            <MacroBadge kind="fat">F</MacroBadge>
            <strong>{meal.fat}</strong>
          </div>
          <div className="macro-value">
            <MacroBadge kind="carbs">C</MacroBadge>
            <strong>{meal.carbs}</strong>
          </div>
        </div>
        {meal.foods.map((food) => (
          <div className="food-row" key={food.id}>
            <span>{food.name}</span>
            <small>{food.amount}</small>
          </div>
        ))}
      </article>
    );
  }

  function renderProgress() {
    const weighIns = Object.values(days)
      .filter((day) => day.weighIn.weight)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latest = weighIns.at(-1)?.weighIn.weight ?? profile.startWeight;
    const change = latest - profile.startWeight;
    const weekStartValue = weekStart(selectedDate);
    const weekEndValue = addDays(weekStartValue, 6);

    return (
      <>
        <h1 className="progress-title">Your fat loss progress</h1>
        <section className="progress-hero">
          {weighIns.length >= 4 ? (
            renderWeightChart(weighIns)
          ) : (
            <div>
              <LineChart size={82} color="#73747a" />
              <p className="muted" style={{ marginTop: 24 }}>
                Your graph will become available once you have four days of weigh-ins.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="section-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            Summary <Info size={24} color="#777982" />
          </h2>
          <div className="summary-grid">
            <div>
              <strong className="muted">Start</strong>
              <h3>{profile.startWeight} lbs</h3>
              <p className="muted">{formatShortDate(profile.startDate)}</p>
            </div>
            <div>
              <strong className="muted">Change</strong>
              <h3>{change === 0 ? "-" : `${change > 0 ? "+" : ""}${change.toFixed(1)} lbs`}</h3>
            </div>
            <div>
              <strong className="muted">Goal</strong>
              <h3>{profile.goalWeight} lbs</h3>
              <p className="muted">{formatGoalDate(profile.goalDate)}</p>
            </div>
          </div>

          <h2 className="section-title">This week</h2>
          <div className="green-note">
            <CheckCircle2 size={28} color="var(--ok)" />
            <div>
              <strong>Great job</strong>
              <p style={{ margin: 0 }}>You are trending to hit the calories you committed to.</p>
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="split-row" style={{ justifyContent: "space-between" }}>
              <strong>W-1</strong>
              <strong>
                {formatShortDate(weekStartValue)} - {formatShortDate(weekEndValue)}
              </strong>
              <button className="danger-button" onClick={() => setFullScreen("edit")}>
                Edit Schedule
              </button>
            </div>
            <div className="split-row" style={{ justifyContent: "space-between", marginTop: 16 }}>
              <span className="muted">
                Calories <strong className="mono">{currentDay.calories}</strong>
              </span>
              <span className="muted">
                Target <strong className="mono">{profile.calories}</strong>
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <span className="muted">Weight </span>
              <strong>{currentDay.weighIn.weight ? `${currentDay.weighIn.weight} lbs` : "- lbs"}</strong>
            </div>
          </div>

          <button className="ghost-button" style={{ marginTop: 18, width: "100%" }} onClick={openCalendar}>
            <RotateCcw size={24} /> View progress history
          </button>
        </section>
      </>
    );
  }

  function renderWeightChart(weighIns: DayLog[]) {
    const values = weighIns.map((day) => day.weighIn.weight ?? profile.startWeight);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    const points = values
      .map((weight, index) => {
        const x = 20 + (index / Math.max(1, values.length - 1)) * 260;
        const y = 150 - ((weight - min) / range) * 110;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg viewBox="0 0 300 180" role="img" aria-label="Weight trend" style={{ width: "100%" }}>
        <polyline fill="none" points={points} stroke="#cc1f35" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }

  function renderExplore() {
    const foods = [
      { name: "Grilled chicken bowl", macros: { calories: 520, protein: 48, fat: 14, carbs: 48 } },
      { name: "Greek yogurt and berries", macros: { calories: 240, protein: 24, fat: 4, carbs: 32 } },
      { name: "Salmon rice plate", macros: { calories: 610, protein: 42, fat: 24, carbs: 54 } },
      { name: "Protein shake", macros: { calories: 180, protein: 30, fat: 3, carbs: 8 } },
    ];

    return (
      <>
        <h1 className="more-title">Explore</h1>
        <section className="schedule-list">
          {foods.map((food) => (
            <button
              className="card"
              key={food.name}
              onClick={() => addLibraryMeal(food.name, food.macros)}
              style={{ padding: 16, textAlign: "left" }}
            >
              <div className="split-row" style={{ justifyContent: "space-between" }}>
                <strong>{food.name}</strong>
                <ChevronRight />
              </div>
              <div className="meal-macros" style={{ margin: "14px -16px -16px" }}>
                <span>{food.macros.calories} cal</span>
                <span>{food.macros.protein} P</span>
                <span>{food.macros.fat} F</span>
                <span>{food.macros.carbs} C</span>
              </div>
            </button>
          ))}
        </section>
      </>
    );
  }

  function renderMore() {
    const rows: Array<[LucideIcon, string, () => void, string?]> = [
      [Box, "Custom Foods", () => setActiveTab("explore")],
      [ClipboardList, "Shopping List", () => null],
      [Scale, "Weigh-ins", () => setSheet("weighin")],
      [Share2, "Share Progress", () => null],
      [Settings, "Settings", () => null],
      [CircleHelp, "Help", () => null],
      [RefreshCw, "Cloud Sync", () => setSheet("cloud"), syncStatus],
      [Ban, "End Current Diet", () => null],
    ];

    return (
      <>
        <h1 className="more-title">More</h1>
        <div className="more-list">
          {rows.map(([Icon, label, action, sub]) => (
            <button key={label} onClick={action}>
              <Icon color="#cf2038" size={28} />
              <span>
                {label}
                {sub && <small className="muted" style={{ display: "block", marginTop: 4 }}>{sub}</small>}
              </span>
              <ChevronRight color="#8b8c93" />
            </button>
          ))}
        </div>
      </>
    );
  }

  function renderWorkoutScreen() {
    return (
      <main className="full-screen phone-frame">
        <div className="nav-row">
          <button className="icon-button flat" onClick={() => setFullScreen(null)} title="Back">
            <ArrowLeft size={32} />
          </button>
          <h1>
            <Dumbbell size={22} /> Workout
            <small>{formatShortDate(selectedDate)}</small>
          </h1>
          <button className="primary-button" onClick={saveWorkout}>
            Save
          </button>
        </div>

        <div className="form-stack">
          <FormSelect
            label="Workout type"
            value={workoutDraft.type}
            onChange={(type) => setWorkoutDraft((current) => ({ ...current, type }))}
            options={["weight training", "cardio", "walk", "sport"]}
          />
          <FormText
            label="Start time"
            value={workoutDraft.startTime}
            onChange={(startTime) => setWorkoutDraft((current) => ({ ...current, startTime }))}
          />
          <FormSelect
            label="Duration"
            value={workoutDraft.duration}
            onChange={(duration) => setWorkoutDraft((current) => ({ ...current, duration }))}
            options={["30m", "45m", "1h", "90m", "2h"]}
          />
          <FormSelect
            label="Intensity"
            value={workoutDraft.intensity}
            onChange={(intensity) => setWorkoutDraft((current) => ({ ...current, intensity }))}
            options={["light", "moderate", "hard"]}
          />
          <ToggleRow
            label="Use workout shake"
            value={workoutDraft.shake}
            onChange={(shake) => setWorkoutDraft((current) => ({ ...current, shake }))}
          />

          <h2 className="section-title">Automation</h2>
          <ToggleRow
            label="Optimize when finished"
            value={workoutDraft.optimize}
            onChange={(optimize) => setWorkoutDraft((current) => ({ ...current, optimize }))}
          />
          <p className="muted">Rearranges unlocked meal times and macros around your workout.</p>
          <ToggleRow
            label="Update my day's calorie targets"
            value={workoutDraft.updateTargets}
            onChange={(updateTargets) => setWorkoutDraft((current) => ({ ...current, updateTargets }))}
          />
          <p className="muted">Updates day targets to match the workout, even when locked.</p>
        </div>
      </main>
    );
  }

  function renderBusyScreen() {
    return (
      <main className="full-screen phone-frame">
        <div className="nav-row">
          <button className="icon-button flat" onClick={() => setFullScreen(null)} title="Back">
            <ArrowLeft size={32} />
          </button>
          <h1>
            <Clock size={22} /> Busy
            <small>{formatShortDate(selectedDate)}</small>
          </h1>
          <button className="primary-button" onClick={saveBusy}>
            Save
          </button>
        </div>

        <div className="form-stack">
          <FormText
            label="Start time"
            value={busyDraft.startTime}
            onChange={(startTime) => setBusyDraft((current) => ({ ...current, startTime }))}
          />
          <FormText
            label="End time"
            value={busyDraft.endTime}
            onChange={(endTime) => setBusyDraft((current) => ({ ...current, endTime }))}
          />

          <h2 className="section-title">Automation</h2>
          <ToggleRow
            label="Optimize when finished"
            value={busyDraft.optimize}
            onChange={(optimize) => setBusyDraft((current) => ({ ...current, optimize }))}
          />
          <p className="muted">Shifts unlocked meal times around this busy block.</p>
        </div>
      </main>
    );
  }

  function renderEditSchedule() {
    return (
      <main className="app-main">
        <div className="nav-row">
          <button className="icon-button flat" onClick={() => setFullScreen(null)} title="Back">
            <ArrowLeft size={32} />
          </button>
          <h1>Edit schedule</h1>
          <button className="primary-button" onClick={() => setFullScreen(null)}>
            Save
          </button>
        </div>

        <div className="topbar" style={{ paddingTop: 0 }}>
          {renderWeekPill()}
          <div>
            <div className="header-row" style={{ gap: 6 }}>
              <MacroBadge kind="cal">
                <Flame size={16} />
              </MacroBadge>
              <strong className="mono">{profile.calories}</strong>
            </div>
            <span className="muted">Trending avg</span>
          </div>
          <div>
            <div className="header-row" style={{ gap: 6 }}>
              <Target size={24} />
              <strong className="mono">{currentDay.calories}</strong>
            </div>
            <span className="muted">Daily target</span>
          </div>
          <Menu />
        </div>

        {renderWeekStrip()}

        <h2 className="section-title">{formatShortDate(selectedDate)}</h2>
        <div className="edit-summary">
          <div className="card" style={{ padding: 16 }}>
            <strong>Day targets</strong>
            <div className="target-grid" style={{ marginTop: 12 }}>
              <EditableTarget kind="cal" value={currentDay.calories} onChange={(calories) => updateDay(selectedDate, (day) => ({ ...day, calories }))}>
                <Flame size={16} />
              </EditableTarget>
              <EditableTarget kind="protein" value={currentDay.protein} onChange={(protein) => updateDay(selectedDate, (day) => ({ ...day, protein }))}>
                P
              </EditableTarget>
              <EditableTarget kind="fat" value={currentDay.fat} onChange={(fat) => updateDay(selectedDate, (day) => ({ ...day, fat }))}>
                F
              </EditableTarget>
              <EditableTarget kind="carbs" value={currentDay.carbs} onChange={(carbs) => updateDay(selectedDate, (day) => ({ ...day, carbs }))}>
                C
              </EditableTarget>
              <button onClick={() => updateProfile({ calories: currentDay.calories, protein: currentDay.protein, fat: currentDay.fat, carbs: currentDay.carbs })}>
                <ChevronRight />
              </button>
            </div>
          </div>
          <div className="step-row header-row">
            <strong className="header-row" style={{ gap: 8 }}>
              <Footprints /> Step count target
            </strong>
            <input
              className="text-input mono"
              value={`${Math.round(currentDay.stepMin / 1000)} - ${Math.round(currentDay.stepMax / 1000)}k steps`}
              onChange={() => null}
            />
          </div>
          <div className="step-row header-row">
            <strong className="header-row" style={{ gap: 8 }}>
              <Utensils /> {currentDay.meals.length} meals
            </strong>
            <span className="time-pill">
              {currentDay.meals[0]?.time ?? "9:00 AM"} - {currentDay.meals.at(-1)?.time ?? "9:00 PM"}
            </span>
          </div>
        </div>

        <div className="split-row" style={{ justifyContent: "space-between" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Meals and activities
          </h2>
          <button className="round-button" onClick={() => setSheet("actions")} title="Add">
            <Plus size={30} />
          </button>
        </div>

        <div className="schedule-list" style={{ marginTop: 16 }}>
          {renderWeighInCard()}
          {currentDay.meals.map((meal) => renderMealCard(meal))}
        </div>
      </main>
    );
  }

  function renderSheets() {
    if (!sheet) {
      return null;
    }

    return (
      <>
        <button className="sheet-backdrop" aria-label="Close sheet" onClick={() => setSheet(null)} />
        <section className="sheet">
          <div className="sheet-handle" />
          {sheet === "actions" && renderActionsSheet()}
          {sheet === "meal" && renderMealSheet()}
          {sheet === "copy" && renderCopySheet()}
          {sheet === "advanced" && renderAdvancedSheet()}
          {sheet === "cloud" && renderCloudSheet()}
          {sheet === "weighin" && renderWeighInSheet()}
          {sheet === "calendar" && renderCalendarSheet()}
          {sheet === "adjust" && renderAdjustMealsSheet()}
        </section>
      </>
    );
  }

  function renderAdjustMealsSheet() {
    const selectedIds = new Set(adjustReset ? currentDay.meals.map((meal) => meal.id) : adjustSelectedMealIds);
    const adjustedMeals = getAdjustedMeals();
    const projectedTotals = getAdjustedTotals(adjustedMeals);
    const projectedCalorieDelta = currentDay.calories - projectedTotals.calories;
    const projectedProteinDelta = currentDay.protein - projectedTotals.protein;

    function toggleMeal(id: string) {
      if (adjustReset) {
        setAdjustReset(false);
        setAdjustSelectedMealIds(currentDay.meals.filter((meal) => meal.id !== id).map((meal) => meal.id));
        return;
      }

      setAdjustSelectedMealIds((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      );
    }

    return (
      <>
        <div className="sheet-title-row adjust-title-row">
          <button className="icon-button flat" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <div>
            <small>{formatSheetDate(selectedDate)}</small>
            <h2>Adjust meals</h2>
          </div>
          <div className="adjust-title-actions">
            <button className="icon-button flat" title="Adjust info" aria-label="Adjust info">
              <Info size={26} />
            </button>
            <button className="primary-button" onClick={saveAdjustedMeals}>
              Save
            </button>
          </div>
        </div>

        <div className="adjust-target-strip">
          <span>
            <MiniBadge kind="cal">
              <Flame size={14} />
            </MiniBadge>
            {currentDay.calories}
          </span>
          <span>
            <MiniBadge kind="protein">P</MiniBadge>
            {currentDay.protein}
          </span>
          <span>
            <MiniBadge kind="fat">F</MiniBadge>
            {currentDay.fat}
          </span>
          <span>
            <MiniBadge kind="carbs">C</MiniBadge>
            {currentDay.carbs}
          </span>
          <strong>Day targets</strong>
        </div>

        <div className="adjust-reset-card">
          <div>
            <strong>Reset to recommendations</strong>
            <p>Rebuilds your meal plan from your day targets.</p>
          </div>
          <button className={`toggle ${adjustReset ? "on" : ""}`} onClick={() => setAdjustReset(!adjustReset)} aria-pressed={adjustReset} />
        </div>

        <div className="adjust-meal-list">
          {adjustedMeals.map((meal) => {
            const selected = selectedIds.has(meal.id);
            const changed =
              meal.adjustedCalories !== meal.calories ||
              meal.adjustedProtein !== meal.protein ||
              meal.adjustedFat !== meal.fat ||
              meal.adjustedCarbs !== meal.carbs;

            return (
              <article className="adjust-meal-card" key={meal.id}>
                <div className="adjust-meal-head">
                  <div className="meal-title">
                    <Utensils size={25} />
                    <span className="meal-name">{meal.name}</span>
                    {meal.foods.length > 0 && <span className="target-pill met">1 food - Targets met</span>}
                  </div>
                  <span className="time-pill">{meal.time}</span>
                  <button
                    className={`adjust-select ${selected ? "selected" : ""}`}
                    onClick={() => toggleMeal(meal.id)}
                    title={selected ? "Include in adjustment" : "Keep current targets"}
                    aria-label={selected ? `Adjust ${meal.name}` : `Keep ${meal.name}`}
                  >
                    {selected && <CheckCircle2 size={26} />}
                  </button>
                </div>
                <MacroLine meal={meal} label={meal.foods.length > 0 ? "Foods" : "Targets"} muted={selected && changed} />
                {(selected || changed) && (
                  <MacroLine
                    meal={{
                      ...meal,
                      calories: meal.adjustedCalories,
                      protein: meal.adjustedProtein,
                      fat: meal.adjustedFat,
                      carbs: meal.adjustedCarbs,
                    }}
                    label="New"
                  />
                )}
              </article>
            );
          })}
        </div>

        <div className="adjust-projection">
          <h3>
            <CalendarDays size={26} /> Your day is projected to be:
          </h3>
          <div>
            <span>
              <MacroBadge kind="cal">
                <Flame size={16} />
              </MacroBadge>
              Calories
            </span>
            <strong>{underText(projectedCalorieDelta)} {"->"} <em>on track</em></strong>
          </div>
          <div>
            <span>
              <MacroBadge kind="protein">P</MacroBadge>
              Protein
            </span>
            <strong>{underText(projectedProteinDelta, "g")} {"->"} <em>on track</em></strong>
          </div>
        </div>
      </>
    );
  }

  function renderCalendarSheet() {
    const base = parseDateKey(calendarMonth);
    const year = base.getFullYear();
    const monthIndex = base.getMonth();
    const monthLabel = new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(base);
    const startOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<string | null> = [];
    for (let index = 0; index < startOffset; index += 1) {
      cells.push(null);
    }
    for (let date = 1; date <= daysInMonth; date += 1) {
      cells.push(dateKey(new Date(year, monthIndex, date)));
    }

    function shiftMonth(amount: number) {
      setCalendarMonth(dateKey(new Date(year, monthIndex + amount, 1)));
    }

    function pickDate(value: string) {
      chooseDate(value);
      setActiveTab("schedule");
      setSheet(null);
    }

    return (
      <>
        <div className="sheet-title-row">
          <button
            className="icon-button flat"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            title="Previous month"
          >
            <ArrowLeft size={24} />
          </button>
          <h2>{monthLabel}</h2>
          <button
            className="icon-button flat"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="calendar-weekdays">
          {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
            <span key={index}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {cells.map((value, index) => {
            if (!value) {
              return <span className="calendar-cell empty" key={`pad-${index}`} />;
            }

            const day = days[value];
            const hasData = Boolean(day && (getTotals(day).calories > 0 || day.weighIn.weight));

            return (
              <button
                key={value}
                className={`calendar-cell ${sameDay(value, selectedDate) ? "active" : ""} ${
                  sameDay(value, today) ? "today" : ""
                }`}
                onClick={() => pickDate(value)}
                title={formatHeaderTitle(value)}
              >
                <span className="calendar-day-num">{parseDateKey(value).getDate()}</span>
                {hasData && <span className="calendar-data-dot" />}
              </button>
            );
          })}
        </div>

        <button
          className="ghost-button"
          style={{ marginTop: 18, width: "100%" }}
          onClick={() => pickDate(today)}
        >
          <CalendarDays size={22} /> Jump to today
        </button>
      </>
    );
  }

  function renderActionsSheet() {
    return (
      <div className="action-list">
        <ActionRow icon={Utensils} label="Add meal" onClick={openNewMeal} />
        <ActionRow
          icon={Dumbbell}
          label="Add workout"
          onClick={() => {
            setWorkoutDraft(newWorkout());
            setSheet(null);
            setFullScreen("workout");
          }}
        />
        <ActionRow
          icon={Clock}
          label="Add busy period"
          onClick={() => {
            setBusyDraft(newBusyBlock());
            setSheet(null);
            setFullScreen("busy");
          }}
        />
        <ActionRow icon={Copy} label="Copy day" onClick={openCopyDay} />
        <ActionRow
          icon={Pencil}
          label="Edit schedule"
          onClick={() => {
            setSheet(null);
            setFullScreen("edit");
          }}
        />
      </div>
    );
  }

  function renderMealSheet() {
    return (
      <>
        <div className="sheet-title-row">
          <button className="icon-button flat" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <h2>{mealDraft.id ? "Edit meal" : "Add meal"}</h2>
          <button className="primary-button" onClick={saveMeal}>
            Save
          </button>
        </div>

        <FormText
          label="Meal time"
          value={mealDraft.time}
          onChange={(time) => setMealDraft((current) => ({ ...current, time }))}
        />

        <div className="number-grid" style={{ marginTop: 12 }}>
          <NutrientInput
            kind="cal"
            icon={<Flame size={24} />}
            label="Calories (kcal)"
            value={mealDraft.calories}
            onChange={(calories) => setMealDraft((current) => ({ ...current, calories }))}
            step={25}
          />
          <NutrientInput
            kind="protein"
            icon="P"
            label="Protein (g)"
            value={mealDraft.protein}
            onChange={(protein) => setMealDraft((current) => ({ ...current, protein }))}
          />
          <NutrientInput
            kind="fat"
            icon="F"
            label="Fat (g)"
            value={mealDraft.fat}
            onChange={(fat) => setMealDraft((current) => ({ ...current, fat }))}
          />
          <NutrientInput
            kind="carbs"
            icon="C"
            label="Carbs (g)"
            value={mealDraft.carbs}
            onChange={(carbs) => setMealDraft((current) => ({ ...current, carbs }))}
          />
        </div>

        <div className="form-stack" style={{ marginTop: 18 }}>
          <input
            className="text-input"
            placeholder="Food name"
            value={mealDraft.foodName}
            onChange={(event) => setMealDraft((current) => ({ ...current, foodName: event.target.value }))}
          />
          <input
            className="text-input"
            placeholder="Amount"
            value={mealDraft.foodAmount}
            onChange={(event) => setMealDraft((current) => ({ ...current, foodAmount: event.target.value }))}
          />
        </div>

        <div className="split-row" style={{ gap: 12, marginTop: 24 }}>
          <button className="ghost-button" style={{ flex: 1 }} onClick={() => setMealDraft(newMealDraft(currentDay.meals.length + 1))}>
            <RotateCcw size={22} /> Reset
          </button>
          <button
            className="ghost-button"
            style={{ flex: 1 }}
            onClick={() => setMealDraft((current) => ({ ...current, locked: !current.locked }))}
          >
            {mealDraft.locked ? <LockKeyhole size={22} /> : <UnlockKeyhole size={22} />}
            {mealDraft.locked ? "Locked" : "Unlocked"}
          </button>
        </div>

        {mealDraft.id && (
          <button className="danger-button" style={{ marginTop: 12, width: "100%" }} onClick={() => deleteMeal(mealDraft.id)}>
            Delete meal
          </button>
        )}
      </>
    );
  }

  function renderCopySheet() {
    const candidates = Array.from({ length: 10 }, (_, index) => addDays(selectedDate, index - 2)).filter(
      (value) => value !== selectedDate,
    );

    return (
      <>
        <div className="sheet-title-row">
          <button className="icon-button flat" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <h2>Copy day</h2>
          <button className="primary-button" onClick={applyCopyDay} disabled={copyTargets.length === 0}>
            Copy
          </button>
        </div>

        <div className="notice">
          <Info size={24} color="#2c95b8" />
          <p>Copying replaces the selected destination days.</p>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div className="split-row" style={{ justifyContent: "space-between" }}>
            <strong>Target average daily calories</strong>
            <strong className="mono">{currentDay.calories}</strong>
          </div>
        </div>

        <div className="split-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <span className="muted">Copy {formatShortDate(selectedDate)} to</span>
          <button className="icon-button flat" onClick={() => setCopyTargets(candidates)}>
            Select all
          </button>
        </div>
        <div className="copy-dates">
          {candidates.map((value) => (
            <button
              className={copyTargets.includes(value) ? "selected" : ""}
              key={value}
              onClick={() => toggleCopyTarget(value)}
            >
              {parseDateKey(value).getDate()}
            </button>
          ))}
        </div>

        <button className="card split-row" style={{ justifyContent: "space-between", marginTop: 16, padding: 16, width: "100%" }} onClick={() => setSheet("advanced")}>
          <span>Advanced options</span>
          <ChevronRight />
        </button>
      </>
    );
  }

  function renderAdvancedSheet() {
    const options: Array<[keyof CopyOptions, string, string?]> = [
      ["activity", "Copy activity level"],
      ["firstLast", "Copy first and last meal times"],
      ["mealCount", "Copy meal count"],
      ["meals", "Copy meals", "Includes meal times and lock state."],
      ["mealTargets", "Copy meal macro targets"],
      ["mealFoods", "Copy meal foods"],
      ["lockedMeals", "Copy fully-locked meals"],
      ["workouts", "Copy workouts"],
      ["busy", "Copy busy periods"],
    ];

    return (
      <>
        <div className="sheet-title-row">
          <button className="icon-button flat" onClick={() => setSheet("copy")}>
            <ArrowLeft size={28} />
          </button>
          <h2>Advanced options</h2>
          <button
            className="icon-button flat"
            onClick={() =>
              setCopyOptions((current) => {
                const allOn = Object.values(current).every(Boolean);
                return Object.fromEntries(
                  Object.keys(current).map((key) => [key, !allOn]),
                ) as CopyOptions;
              })
            }
          >
            {Object.values(copyOptions).every(Boolean) ? "Deselect all" : "Select all"}
          </button>
        </div>

        {options.map(([key, label, detail]) => (
          <button
            className="option-row"
            key={key}
            onClick={() => setCopyOptions((current) => ({ ...current, [key]: !current[key] }))}
            style={{ width: "100%", textAlign: "left" }}
          >
            <span>
              <strong>{label}</strong>
              {detail && <small className="muted" style={{ display: "block", marginTop: 6 }}>{detail}</small>}
            </span>
            {copyOptions[key] && <CheckCircle2 color="var(--ok)" size={30} />}
          </button>
        ))}
      </>
    );
  }

  function renderCloudSheet() {
    return (
      <>
        <div className="sheet-title-row">
          <button className="icon-button flat" onClick={() => setSheet(null)}>
            Close
          </button>
          <h2>Cloud Sync</h2>
          <button className="primary-button" onClick={copySyncKey}>
            Copy
          </button>
        </div>

        <div className="status-card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="split-row" style={{ justifyContent: "space-between" }}>
            <strong>{syncStatus}</strong>
            <RefreshCw size={24} color="#cf2038" />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            {lastSync ? `Last sync ${new Date(lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Sync starts after your first save."}
          </p>
        </div>

        <label className="muted">Your cloud backup key</label>
        <div className="sync-key">{syncKey}</div>

        <div className="form-stack" style={{ marginTop: 18 }}>
          <input
            className="text-input"
            placeholder="Restore with another sync key"
            value={restoreKey}
            onChange={(event) => setRestoreKey(event.target.value)}
          />
          <button className="primary-button" onClick={restoreCloudKey}>
            Restore backup
          </button>
        </div>
      </>
    );
  }

  function renderWeighInSheet() {
    return (
      <>
        <div className="sheet-title-row">
          <button className="icon-button flat" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <h2>Weigh-in</h2>
          <button className="primary-button" onClick={saveWeighIn}>
            Save
          </button>
        </div>
        <FormText label="Time" value={currentDay.weighIn.time} onChange={(time) => updateDay(selectedDate, (day) => ({ ...day, weighIn: { ...day.weighIn, time } }))} />
        <div className="form-row">
          <label>Weight</label>
          <input
            className="number-input"
            inputMode="decimal"
            value={weighDraft}
            onChange={(event) => setWeighDraft(event.target.value)}
            placeholder="lbs"
          />
        </div>
      </>
    );
  }

  function renderDock() {
    if (activeTab !== "schedule" && fullScreen !== "edit") {
      return null;
    }

    return (
      <div className="dock">
        <div className="summary-stat" style={{ position: "relative" }}>
          <CalendarX color="#cc1f35" size={30} />
          <span className="nav-dot" />
        </div>
        <div className="summary-stat">
          <MacroBadge kind="cal">
            <Flame size={16} />
          </MacroBadge>
          <span>{underText(calorieDelta)}</span>
        </div>
        <div className="summary-stat">
          <MacroBadge kind="protein">P</MacroBadge>
          <span>{underText(proteinDelta, "g")}</span>
        </div>
        <button className="icon-button" onClick={openAdjustMeals} title="Adjust meals">
          <WandSparkles size={28} />
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="phone-frame">{renderBody()}</div>
      {renderDock()}
      {!fullScreen && (
        <nav className="tabbar" aria-label="Primary">
          <button className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>
            <span className="nav-dot" />
            <IconLabel icon={CalendarDays} label="Schedule" active={activeTab === "schedule"} />
          </button>
          <button className={activeTab === "progress" ? "active" : ""} onClick={() => setActiveTab("progress")}>
            <IconLabel icon={LineChart} label="Progress" active={activeTab === "progress"} />
          </button>
          <button className={activeTab === "explore" ? "active" : ""} onClick={() => setActiveTab("explore")}>
            <IconLabel icon={Map} label="Explore" active={activeTab === "explore"} />
          </button>
          <button className={activeTab === "more" ? "active" : ""} onClick={() => setActiveTab("more")}>
            <IconLabel icon={MoreHorizontal} label="More" active={activeTab === "more"} />
          </button>
        </nav>
      )}
      {renderWeekMenu()}
      {renderSheets()}
    </div>
  );
}

function newMealDraft(index = 1): MealDraft {
  return {
    id: null,
    name: `Meal ${index}`,
    time: "7:45 PM",
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    locked: false,
    foodName: "",
    foodAmount: "",
  };
}

function newWorkout(): Workout {
  return {
    id: makeId("workout"),
    type: "weight training",
    startTime: "12:00 PM",
    duration: "1h",
    intensity: "light",
    shake: false,
    optimize: false,
    updateTargets: true,
  };
}

function newBusyBlock(): BusyBlock {
  return {
    id: makeId("busy"),
    startTime: "12:00 PM",
    endTime: "1:00 PM",
    optimize: false,
  };
}

function FormText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <input className="text-input mono" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <select className="select-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <button className={`toggle ${value ? "on" : ""}`} onClick={() => onChange(!value)} aria-pressed={value} />
    </div>
  );
}

function NutrientInput({
  kind,
  icon,
  label,
  value,
  step = 5,
  onChange,
}: {
  kind: "cal" | "protein" | "fat" | "carbs";
  icon: React.ReactNode;
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="nutrient-row">
      <MacroBadge kind={kind}>{icon}</MacroBadge>
      <label className="text-input" style={{ display: "grid" }}>
        <span className="muted">{label}</span>
        <input
          style={{ background: "transparent", border: 0, outline: 0, width: "100%" }}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
        />
      </label>
      <div className="stepper">
        <button onClick={() => onChange(clamp(value - step))} title={`Decrease ${label}`}>
          <Minus />
        </button>
        <button onClick={() => onChange(clamp(value + step))} title={`Increase ${label}`}>
          <Plus />
        </button>
      </div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      <Icon size={28} />
      <span>{label}</span>
      <ChevronRight />
    </button>
  );
}

function MacroLine({
  meal,
  label,
  muted,
}: {
  meal: Pick<Meal, "calories" | "protein" | "fat" | "carbs">;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className={`adjust-macro-line ${muted ? "muted-line" : ""}`}>
      <span>
        <MacroBadge kind="cal">
          <Flame size={16} />
        </MacroBadge>
        {meal.calories}
      </span>
      <span>
        <MacroBadge kind="protein">P</MacroBadge>
        {meal.protein}
      </span>
      <span>
        <MacroBadge kind="fat">F</MacroBadge>
        {meal.fat}
      </span>
      <span>
        <MacroBadge kind="carbs">C</MacroBadge>
        {meal.carbs}
      </span>
      <strong>{label}</strong>
    </div>
  );
}

function EditableTarget({
  kind,
  value,
  children,
  onChange,
}: {
  kind: "cal" | "protein" | "fat" | "carbs";
  value: number;
  children: React.ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <MiniBadge kind={kind}>{children}</MiniBadge>
      <input
        className="mono"
        inputMode="numeric"
        style={{ background: "transparent", border: 0, outline: 0, width: 54 }}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
      />
    </div>
  );
}
