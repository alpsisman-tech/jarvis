// Jarvis agent tools that execute IN THE BROWSER against the data store, so
// they work in local/demo mode and cloud mode alike. The /api/jarvis route
// executes server-side tools (weather, projects, GitHub, n8n) itself and hands
// these back to the client mid-loop.

import {
  getRecovery, getSleep, getStrain, getGarminDaily, getRuns, getWorkouts,
  saveWorkout, deleteWorkout, logNutrition, logHydration, getNutrition,
  getHydration, getSettings, saveSettings,
} from "./store";
import { todayISO, daysAgoISO, addDays, uid, fmtPace } from "./format";
import { muscleVolume } from "./muscleVolume";
import { EXERCISE_MAP, EXERCISES } from "./exercises";
import type { Workout, WorkoutType, Meal } from "./types";

export const CLIENT_TOOL_NAMES = [
  "get_health_summary", "get_runs", "get_workouts", "plan_workout",
  "update_workout_status", "delete_workout", "log_nutrition", "log_hydration",
  "get_nutrition_summary", "list_exercises", "update_targets",
] as const;

export function isClientTool(name: string): boolean {
  return (CLIENT_TOOL_NAMES as readonly string[]).includes(name);
}

type Input = Record<string, unknown>;

export async function executeClientTool(name: string, input: Input): Promise<string> {
  try {
    switch (name) {
      case "get_health_summary": {
        const days = Math.min(Number(input.days) || 7, 120);
        const [rec, sleep, strain, garmin] = await Promise.all([
          getRecovery(days), getSleep(days), getStrain(days), getGarminDaily(days),
        ]);
        return JSON.stringify({
          period_days: days,
          recovery: rec.map((r) => ({ date: r.date, score: r.recovery_score, hrv: r.hrv_ms, rhr: r.resting_hr })),
          sleep: sleep.map((s) => ({ date: s.date, hours: s.hours, performance: s.performance_pct })),
          strain: strain.map((s) => ({ date: s.date, strain: s.strain, calories: s.calories })),
          garmin: garmin.map((g) => ({ date: g.date, steps: g.steps, body_battery: g.body_battery, stress: g.stress_avg, vo2max: g.vo2max })),
        });
      }
      case "get_runs": {
        const days = Math.min(Number(input.days) || 30, 120);
        const runs = await getRuns(days);
        return JSON.stringify(runs.map((r) => ({
          id: r.id, date: r.date, name: r.name, km: r.distance_km,
          duration_sec: r.duration_sec, pace: fmtPace(r.avg_pace_sec),
          avg_hr: r.avg_hr, cadence: r.cadence, elevation_m: r.elevation_gain_m,
          training_effect: r.training_effect,
          splits: input.detail ? r.splits : undefined,
        })));
      }
      case "get_workouts": {
        const from = String(input.from ?? daysAgoISO(14));
        const to = String(input.to ?? addDays(todayISO(), 7));
        const ws = await getWorkouts(from, to);
        const vol = muscleVolume(ws);
        return JSON.stringify({
          workouts: ws.map((w) => ({
            id: w.id, date: w.date, title: w.title, type: w.type, status: w.status,
            exercises: w.exercises.map((e) => ({
              name: EXERCISE_MAP[e.exercise_id]?.name ?? e.exercise_id,
              exercise_id: e.exercise_id,
              sets: e.sets.map((s) => `${s.reps}x${s.weight_kg}kg`),
            })),
          })),
          muscle_volume_sets: vol,
        });
      }
      case "plan_workout": {
        const exercises = (Array.isArray(input.exercises) ? input.exercises : []) as {
          exercise_id: string; sets: number; reps: number; weight_kg?: number;
        }[];
        const invalid = exercises.filter((e) => !EXERCISE_MAP[e.exercise_id]);
        if (invalid.length > 0) {
          return JSON.stringify({
            error: `Unknown exercise ids: ${invalid.map((e) => e.exercise_id).join(", ")}. Call list_exercises for valid ids.`,
          });
        }
        const w: Workout = {
          id: uid(),
          date: String(input.date ?? todayISO()),
          title: String(input.title ?? "Workout"),
          type: (input.type as WorkoutType) ?? "other",
          status: "planned",
          exercises: exercises.map((e) => ({
            exercise_id: e.exercise_id,
            sets: Array.from({ length: Math.max(1, e.sets) }, () => ({
              reps: e.reps, weight_kg: e.weight_kg ?? 0,
            })),
          })),
          duration_min: null,
          notes: typeof input.notes === "string" ? input.notes : null,
        };
        await saveWorkout(w);
        return JSON.stringify({ ok: true, workout_id: w.id, date: w.date, title: w.title });
      }
      case "update_workout_status": {
        const from = daysAgoISO(60), to = addDays(todayISO(), 30);
        const ws = await getWorkouts(from, to);
        const w = ws.find((x) => x.id === input.id);
        if (!w) return JSON.stringify({ error: "workout not found" });
        w.status = input.status as Workout["status"];
        await saveWorkout(w);
        return JSON.stringify({ ok: true, id: w.id, status: w.status });
      }
      case "delete_workout": {
        await deleteWorkout(String(input.id));
        return JSON.stringify({ ok: true });
      }
      case "log_nutrition": {
        const entry = {
          id: uid(), date: String(input.date ?? todayISO()),
          meal: (input.meal as Meal) ?? "snack",
          name: String(input.name ?? "Food"),
          calories: Number(input.calories) || 0,
          protein_g: Number(input.protein_g) || 0,
          carbs_g: Number(input.carbs_g) || 0,
          fat_g: Number(input.fat_g) || 0,
        };
        await logNutrition(entry);
        return JSON.stringify({ ok: true, logged: entry });
      }
      case "log_hydration": {
        const entry = { id: uid(), date: String(input.date ?? todayISO()), ml: Number(input.ml) || 250 };
        await logHydration(entry);
        return JSON.stringify({ ok: true, logged: entry });
      }
      case "get_nutrition_summary": {
        const days = Math.min(Number(input.days) || 7, 60);
        const from = daysAgoISO(days - 1), to = todayISO();
        const [nut, hyd] = await Promise.all([getNutrition(from, to), getHydration(from, to)]);
        const s = getSettings();
        const byDate: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number; water_ml: number }> = {};
        for (const n of nut) {
          byDate[n.date] ??= { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 };
          byDate[n.date].calories += n.calories;
          byDate[n.date].protein_g += n.protein_g;
          byDate[n.date].carbs_g += n.carbs_g;
          byDate[n.date].fat_g += n.fat_g;
        }
        for (const h of hyd) {
          byDate[h.date] ??= { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, water_ml: 0 };
          byDate[h.date].water_ml += h.ml;
        }
        return JSON.stringify({ targets: s.targets, days: byDate });
      }
      case "list_exercises": {
        return JSON.stringify(EXERCISES.map((e) => ({
          exercise_id: e.id, name: e.name, primary: e.primary, secondary: e.secondary, equipment: e.equipment,
        })));
      }
      case "update_targets": {
        const s = getSettings();
        s.targets = {
          calories: Number(input.calories) || s.targets.calories,
          protein_g: Number(input.protein_g) || s.targets.protein_g,
          carbs_g: Number(input.carbs_g) || s.targets.carbs_g,
          fat_g: Number(input.fat_g) || s.targets.fat_g,
          water_ml: Number(input.water_ml) || s.targets.water_ml,
        };
        saveSettings(s);
        return JSON.stringify({ ok: true, targets: s.targets });
      }
      default:
        return JSON.stringify({ error: `unknown client tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
}

// Compact context pack sent with each chat request so Jarvis can answer basic
// questions without tool round-trips.
export async function buildContextPack(): Promise<string> {
  const [rec, sleep, strain, garmin, runs, workouts, nut, hyd] = await Promise.all([
    getRecovery(2), getSleep(2), getStrain(2), getGarminDaily(2), getRuns(7),
    getWorkouts(todayISO(), addDays(todayISO(), 3)),
    getNutrition(todayISO(), todayISO()), getHydration(todayISO(), todayISO()),
  ]);
  const s = getSettings();
  const today = rec[rec.length - 1];
  const sl = sleep[sleep.length - 1];
  const st = strain[strain.length - 1];
  const g = garmin[garmin.length - 1];
  const kcal = nut.reduce((x, n) => x + n.calories, 0);
  const protein = nut.reduce((x, n) => x + n.protein_g, 0);
  const water = hyd.reduce((x, h) => x + h.ml, 0);
  const lastRun = runs[runs.length - 1];
  return [
    `date=${todayISO()} user=${s.name} location=${s.place}`,
    today && `recovery=${today.recovery_score}% hrv=${today.hrv_ms}ms rhr=${today.resting_hr}bpm`,
    sl && `sleep=${sl.hours}h (perf ${sl.performance_pct}%)`,
    st && `day_strain=${st.strain}`,
    g && `steps=${g.steps} body_battery=${g.body_battery} stress=${g.stress_avg} vo2max=${g.vo2max}`,
    lastRun && `last_run=${lastRun.date} ${lastRun.distance_km}km @ ${fmtPace(lastRun.avg_pace_sec)}`,
    `today_nutrition=${kcal}kcal protein=${protein}g water=${water}ml (targets ${s.targets.calories}kcal/${s.targets.protein_g}g/${s.targets.water_ml}ml)`,
    workouts.length > 0
      ? `upcoming_workouts=${workouts.map((w) => `${w.date}:${w.title}(${w.status})`).join(", ")}`
      : "upcoming_workouts=none",
  ].filter(Boolean).join("\n");
}
