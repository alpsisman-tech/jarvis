import type { MuscleGroup, Workout } from "./types";
import { EXERCISE_MAP, MUSCLE_GROUPS } from "./exercises";

// Training volume per muscle group: hard sets, counting secondary movers at half.
export function muscleVolume(workouts: Workout[]): Record<MuscleGroup, number> {
  const vol = Object.fromEntries(MUSCLE_GROUPS.map((m) => [m, 0])) as Record<MuscleGroup, number>;
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    for (const we of w.exercises) {
      const def = EXERCISE_MAP[we.exercise_id];
      if (!def) continue;
      const sets = we.sets.length;
      for (const m of def.primary) vol[m] += sets;
      for (const m of def.secondary) vol[m] += sets * 0.5;
    }
  }
  return vol;
}

// Days since each muscle was last trained (Infinity if never in range)
export function muscleRecency(workouts: Workout[], today: string): Record<MuscleGroup, number> {
  const last = {} as Record<MuscleGroup, string>;
  for (const w of workouts) {
    if (w.status !== "completed") continue;
    for (const we of w.exercises) {
      const def = EXERCISE_MAP[we.exercise_id];
      if (!def) continue;
      for (const m of [...def.primary, ...def.secondary]) {
        if (!last[m] || w.date > last[m]) last[m] = w.date;
      }
    }
  }
  const out = {} as Record<MuscleGroup, number>;
  for (const m of MUSCLE_GROUPS) {
    out[m] = last[m]
      ? Math.round((new Date(today).getTime() - new Date(last[m]).getTime()) / 86400000)
      : Infinity;
  }
  return out;
}
