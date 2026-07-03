// Deterministic demo dataset. Generated with a seeded RNG so charts and
// insights tell a coherent story: a training block with progressive overload,
// recovery dipping after hard days, runs getting faster over the block.
// Replaced by real WHOOP/Garmin/Supabase data once integrations are connected.

import type {
  RecoveryDay, SleepDay, StrainDay, GarminDaily, RunActivity, RunSplit,
  Workout, WorkoutExercise, NutritionLog, HydrationLog,
} from "./types";
import { addDays, daysAgoISO, todayISO, clamp } from "./format";

const DAYS = 120;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260703);
const rnd = (lo: number, hi: number) => lo + rng() * (hi - lo);
const rndInt = (lo: number, hi: number) => Math.round(rnd(lo, hi));

// day index 0 = oldest … DAYS-1 = today
const dates: string[] = [];
for (let i = DAYS - 1; i >= 0; i--) dates.push(daysAgoISO(i));

// ── Training plan (PPL x2 / week + 3 runs) ──────────────────────────────────
// Weekly template keyed by weekday (Mon=1 … Sun=0)
const PPL: Record<number, { title: string; type: Workout["type"]; ex: [string, number, number, number][] } | { title: string; type: "run" } | null> = {
  1: { title: "Push A", type: "push", ex: [["bench_press", 4, 6, 80], ["incline_db_press", 3, 10, 30], ["ohp", 3, 8, 45], ["lateral_raise", 4, 15, 10], ["tricep_pushdown", 3, 12, 30]] },
  2: { title: "Pull A", type: "pull", ex: [["deadlift", 3, 5, 140], ["pullup", 4, 8, 0], ["barbell_row", 3, 10, 70], ["face_pull", 3, 15, 20], ["barbell_curl", 3, 10, 30]] },
  3: { title: "Easy run", type: "run" },
  4: { title: "Legs A", type: "legs", ex: [["squat", 4, 6, 100], ["rdl", 3, 10, 90], ["leg_press", 3, 12, 180], ["calf_raise", 4, 15, 60], ["hanging_leg_raise", 3, 12, 0]] },
  5: { title: "Push B", type: "push", ex: [["ohp", 4, 6, 47.5], ["bench_press", 3, 10, 70], ["dips", 3, 12, 0], ["cable_fly", 3, 15, 15], ["skullcrusher", 3, 10, 25]] },
  6: { title: "Tempo run", type: "run" },
  0: { title: "Long run", type: "run" },
};

// ── WHOOP-shaped physiology ──────────────────────────────────────────────────
export const DEMO_RECOVERY: RecoveryDay[] = [];
export const DEMO_SLEEP: SleepDay[] = [];
export const DEMO_STRAIN: StrainDay[] = [];
export const DEMO_GARMIN_DAILY: GarminDaily[] = [];
export const DEMO_RUNS: RunActivity[] = [];
export const DEMO_WORKOUTS: Workout[] = [];

let fatigue = 0.3; // rolling fatigue 0..1 — drives recovery the next morning

for (let i = 0; i < DAYS; i++) {
  const date = dates[i];
  const dow = new Date(date + "T12:00:00").getDay();
  const plan = PPL[dow];
  const isRun = !!plan && plan.type === "run";
  const isLift = !!plan && plan.type !== "run";
  const progress = i / DAYS; // fitness improves over the block

  // Sleep first (drives recovery)
  const shortNight = rng() < 0.15;
  const hours = clamp(rnd(6.9, 8.3) - (shortNight ? rnd(1.2, 2.0) : 0), 4.8, 9);
  const need = 8 + fatigue * 0.8;
  const rem = hours * rnd(0.2, 0.26);
  const deep = hours * rnd(0.16, 0.22);
  const awake = rnd(0.3, 0.7);
  DEMO_SLEEP.push({
    date, hours: +hours.toFixed(2), need_hours: +need.toFixed(2),
    performance_pct: Math.round(clamp((hours / need) * 100, 40, 100)),
    efficiency_pct: Math.round(rnd(88, 96)),
    rem_hours: +rem.toFixed(2), deep_hours: +deep.toFixed(2),
    light_hours: +(hours - rem - deep).toFixed(2), awake_hours: +awake.toFixed(2),
    bedtime: `${23 + (rng() < 0.3 ? 1 : 0)}:${String(rndInt(0, 59)).padStart(2, "0")}`.replace("24:", "00:"),
    waketime: `0${rndInt(6, 8)}:${String(rndInt(0, 45)).padStart(2, "0")}`,
  });

  // Recovery reflects yesterday's fatigue + last night's sleep
  const sleepFactor = clamp((hours - 5.5) / 3, 0, 1);
  const recovery = clamp(30 + sleepFactor * 55 - fatigue * 30 + rnd(-8, 8), 5, 99);
  const hrv = clamp(55 + progress * 15 + (recovery - 50) * 0.55 + rnd(-6, 6), 25, 130);
  DEMO_RECOVERY.push({
    date, recovery_score: Math.round(recovery), hrv_ms: Math.round(hrv),
    resting_hr: Math.round(clamp(56 - progress * 4 - (recovery - 50) * 0.08 + rnd(-1.5, 1.5), 44, 66)),
    spo2: +rnd(95.5, 98.5).toFixed(1), skin_temp_c: +rnd(33.4, 34.6).toFixed(1),
  });

  // Strain from the day's training
  const baseStrain = isLift ? rnd(12, 15.5) : isRun ? rnd(10.5, 16) : rnd(5, 9);
  DEMO_STRAIN.push({
    date, strain: +clamp(baseStrain + rnd(-1, 1), 3, 20.5).toFixed(1),
    calories: rndInt(2300, 3300), avg_hr: rndInt(62, 74), max_hr: rndInt(130, 182),
  });
  fatigue = clamp(fatigue * 0.6 + (baseStrain / 21) * 0.55 - sleepFactor * 0.12, 0.05, 1);

  // Garmin daily
  DEMO_GARMIN_DAILY.push({
    date, steps: rndInt(isRun ? 12000 : 6000, isRun ? 19000 : 12500),
    body_battery: Math.round(clamp(recovery * 0.7 + rnd(10, 30), 15, 100)),
    stress_avg: rndInt(22, 46), resting_hr: Math.round(clamp(55 - progress * 4 + rnd(-2, 2), 44, 64)),
    intensity_minutes: rndInt(isRun || isLift ? 40 : 0, isRun ? 120 : 70),
    floors: rndInt(4, 18), calories_out: rndInt(2400, 3400),
    vo2max: +(49 + progress * 3.2 + rnd(-0.3, 0.3)).toFixed(1),
  });

  // Runs (with splits + HR zones) — Strava-style detail
  if (isRun) {
    const kind = plan!.title;
    const dist = kind === "Long run" ? rnd(12, 16) : kind === "Tempo run" ? rnd(7, 9) : rnd(5, 7);
    const basePace = kind === "Tempo run" ? 285 : kind === "Long run" ? 330 : 320; // sec/km
    const pace = basePace - progress * 22 + rnd(-6, 6);
    const splits: RunSplit[] = [];
    for (let k = 1; k <= Math.floor(dist); k++) {
      const drift = kind === "Long run" ? k * 1.2 : kind === "Tempo run" ? -k * 0.6 : rnd(-3, 3);
      splits.push({
        km: k, pace_sec: Math.round(pace + drift + rnd(-7, 7)),
        hr: Math.round(clamp(138 + k * 1.4 + (kind === "Tempo run" ? 18 : 0) + rnd(-4, 4), 120, 188)),
        elev_m: Math.round(rnd(-8, 12)),
      });
    }
    const durationSec = Math.round(dist * pace);
    const z = kind === "Tempo run" ? [0.05, 0.15, 0.35, 0.35, 0.1] : kind === "Long run" ? [0.1, 0.45, 0.35, 0.09, 0.01] : [0.15, 0.5, 0.3, 0.05, 0];
    DEMO_RUNS.push({
      id: `run-${date}`, date, name: kind,
      distance_km: +dist.toFixed(2), duration_sec: durationSec,
      avg_pace_sec: Math.round(pace),
      avg_hr: Math.round(splits.reduce((s, x) => s + x.hr, 0) / splits.length),
      max_hr: Math.max(...splits.map((s) => s.hr)) + rndInt(2, 8),
      cadence: rndInt(168, 180), elevation_gain_m: Math.round(splits.reduce((s, x) => s + Math.max(0, x.elev_m), 0)),
      calories: Math.round(dist * rnd(62, 70)), training_effect: +clamp(kind === "Tempo run" ? rnd(3.4, 4.6) : rnd(2.2, 3.6), 1, 5).toFixed(1),
      splits, hr_zones: z.map((f) => Math.round(f * durationSec)) as RunActivity["hr_zones"],
    });
  }

  // Strength workouts (past = completed with progressive overload; future handled below)
  if (isLift && "ex" in plan!) {
    const weeksIn = Math.floor(i / 7);
    const exercises: WorkoutExercise[] = plan!.ex.map(([exId, sets, reps, startKg]) => ({
      exercise_id: exId,
      sets: Array.from({ length: sets }, (_, si) => ({
        reps: reps + (si === sets - 1 ? rndInt(-2, 1) : 0),
        weight_kg: startKg === 0 ? 0 : +(startKg + weeksIn * (startKg > 60 ? 2.5 : 1.25)).toFixed(1),
        rpe: rndInt(7, 9),
      })),
    }));
    DEMO_WORKOUTS.push({
      id: `wk-${date}`, date, title: plan!.title, type: plan!.type as Workout["type"],
      status: rng() < 0.06 ? "skipped" : "completed",
      exercises, duration_min: rndInt(55, 80), notes: null,
    });
  } else if (isRun) {
    DEMO_WORKOUTS.push({
      id: `wk-${date}`, date, title: plan!.title, type: "run", status: "completed",
      exercises: [], duration_min: null, notes: null, source_run_id: `run-${date}`,
    });
  }
}

// Upcoming week: planned sessions from the same template
for (let f = 1; f <= 7; f++) {
  const date = addDays(todayISO(), f);
  const dow = new Date(date + "T12:00:00").getDay();
  const plan = PPL[dow];
  if (!plan) continue;
  if (plan.type === "run") {
    DEMO_WORKOUTS.push({ id: `wk-${date}`, date, title: plan.title, type: "run", status: "planned", exercises: [], duration_min: null, notes: null });
  } else if ("ex" in plan) {
    const weeksIn = Math.floor(DAYS / 7);
    DEMO_WORKOUTS.push({
      id: `wk-${date}`, date, title: plan.title, type: plan.type as Workout["type"], status: "planned",
      exercises: plan.ex.map(([exId, sets, reps, startKg]) => ({
        exercise_id: exId,
        sets: Array.from({ length: sets }, () => ({ reps, weight_kg: startKg === 0 ? 0 : +(startKg + weeksIn * (startKg > 60 ? 2.5 : 1.25)).toFixed(1) })),
      })),
      duration_min: null, notes: null,
    });
  }
}

// ── Nutrition & hydration (last 30 days) ────────────────────────────────────
export const DEMO_NUTRITION: NutritionLog[] = [];
export const DEMO_HYDRATION: HydrationLog[] = [];

const MEALS: [NutritionLog["meal"], string, number, number, number, number][] = [
  ["breakfast", "Oats, whey & banana", 520, 38, 68, 12],
  ["lunch", "Chicken, rice & veg", 680, 52, 72, 16],
  ["snack", "Greek yogurt & almonds", 280, 22, 14, 14],
  ["dinner", "Salmon, potatoes & salad", 720, 46, 58, 30],
  ["snack", "Protein shake", 180, 30, 6, 3],
];

for (let i = 29; i >= 0; i--) {
  const date = daysAgoISO(i);
  const skipSnack = rng() < 0.35;
  MEALS.forEach(([meal, name, kcal, p, c, fat], mi) => {
    if (skipSnack && mi === 4) return;
    const jitter = rnd(0.85, 1.15);
    DEMO_NUTRITION.push({
      id: `nut-${date}-${mi}`, date, meal, name,
      calories: Math.round(kcal * jitter), protein_g: Math.round(p * jitter),
      carbs_g: Math.round(c * jitter), fat_g: Math.round(fat * jitter),
    });
  });
  const glasses = rndInt(5, 9);
  for (let g = 0; g < glasses; g++) {
    DEMO_HYDRATION.push({ id: `hyd-${date}-${g}`, date, ml: [250, 330, 500][rndInt(0, 2)] });
  }
}
