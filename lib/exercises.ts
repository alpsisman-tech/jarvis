import type { MuscleGroup } from "./types";

export interface ExerciseDef {
  id: string;
  name: string;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight" | "kettlebell" | "other";
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "core", "glutes", "quads", "hamstrings", "calves",
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps",
  triceps: "Triceps", forearms: "Forearms", core: "Core", glutes: "Glutes",
  quads: "Quads", hamstrings: "Hamstrings", calves: "Calves",
};

export const EXERCISES: ExerciseDef[] = [
  { id: "bench_press", name: "Barbell Bench Press", primary: ["chest"], secondary: ["triceps", "shoulders"], equipment: "barbell" },
  { id: "incline_db_press", name: "Incline Dumbbell Press", primary: ["chest"], secondary: ["shoulders", "triceps"], equipment: "dumbbell" },
  { id: "cable_fly", name: "Cable Fly", primary: ["chest"], secondary: [], equipment: "cable" },
  { id: "dips", name: "Dips", primary: ["chest", "triceps"], secondary: ["shoulders"], equipment: "bodyweight" },
  { id: "ohp", name: "Overhead Press", primary: ["shoulders"], secondary: ["triceps", "core"], equipment: "barbell" },
  { id: "db_shoulder_press", name: "Dumbbell Shoulder Press", primary: ["shoulders"], secondary: ["triceps"], equipment: "dumbbell" },
  { id: "lateral_raise", name: "Lateral Raise", primary: ["shoulders"], secondary: [], equipment: "dumbbell" },
  { id: "rear_delt_fly", name: "Rear Delt Fly", primary: ["shoulders"], secondary: ["back"], equipment: "dumbbell" },
  { id: "tricep_pushdown", name: "Triceps Pushdown", primary: ["triceps"], secondary: [], equipment: "cable" },
  { id: "skullcrusher", name: "Skullcrusher", primary: ["triceps"], secondary: [], equipment: "barbell" },
  { id: "deadlift", name: "Deadlift", primary: ["back", "hamstrings", "glutes"], secondary: ["forearms", "core"], equipment: "barbell" },
  { id: "pullup", name: "Pull-up", primary: ["back"], secondary: ["biceps", "forearms"], equipment: "bodyweight" },
  { id: "barbell_row", name: "Barbell Row", primary: ["back"], secondary: ["biceps", "core"], equipment: "barbell" },
  { id: "lat_pulldown", name: "Lat Pulldown", primary: ["back"], secondary: ["biceps"], equipment: "cable" },
  { id: "seated_row", name: "Seated Cable Row", primary: ["back"], secondary: ["biceps"], equipment: "cable" },
  { id: "face_pull", name: "Face Pull", primary: ["shoulders", "back"], secondary: [], equipment: "cable" },
  { id: "barbell_curl", name: "Barbell Curl", primary: ["biceps"], secondary: ["forearms"], equipment: "barbell" },
  { id: "hammer_curl", name: "Hammer Curl", primary: ["biceps", "forearms"], secondary: [], equipment: "dumbbell" },
  { id: "incline_curl", name: "Incline Dumbbell Curl", primary: ["biceps"], secondary: [], equipment: "dumbbell" },
  { id: "squat", name: "Back Squat", primary: ["quads", "glutes"], secondary: ["core", "hamstrings"], equipment: "barbell" },
  { id: "front_squat", name: "Front Squat", primary: ["quads"], secondary: ["core", "glutes"], equipment: "barbell" },
  { id: "leg_press", name: "Leg Press", primary: ["quads", "glutes"], secondary: [], equipment: "machine" },
  { id: "rdl", name: "Romanian Deadlift", primary: ["hamstrings", "glutes"], secondary: ["back", "forearms"], equipment: "barbell" },
  { id: "leg_curl", name: "Leg Curl", primary: ["hamstrings"], secondary: [], equipment: "machine" },
  { id: "leg_extension", name: "Leg Extension", primary: ["quads"], secondary: [], equipment: "machine" },
  { id: "hip_thrust", name: "Hip Thrust", primary: ["glutes"], secondary: ["hamstrings"], equipment: "barbell" },
  { id: "walking_lunge", name: "Walking Lunge", primary: ["quads", "glutes"], secondary: ["hamstrings", "core"], equipment: "dumbbell" },
  { id: "calf_raise", name: "Standing Calf Raise", primary: ["calves"], secondary: [], equipment: "machine" },
  { id: "plank", name: "Plank", primary: ["core"], secondary: [], equipment: "bodyweight" },
  { id: "hanging_leg_raise", name: "Hanging Leg Raise", primary: ["core"], secondary: ["forearms"], equipment: "bodyweight" },
  { id: "cable_crunch", name: "Cable Crunch", primary: ["core"], secondary: [], equipment: "cable" },
  { id: "farmer_carry", name: "Farmer Carry", primary: ["forearms", "core"], secondary: ["shoulders"], equipment: "kettlebell" },
];

export const EXERCISE_MAP: Record<string, ExerciseDef> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function exerciseName(id: string): string {
  return EXERCISE_MAP[id]?.name ?? id.replace(/_/g, " ");
}
