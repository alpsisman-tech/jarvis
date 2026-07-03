// Shared data types for JARVIS. Shapes mirror the Supabase tables in
// supabase/schema.sql; the demo generator and local store produce the same
// shapes so every page renders identically in demo, local and cloud modes.

export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms"
  | "core" | "glutes" | "quads" | "hamstrings" | "calves";

export interface RecoveryDay {
  date: string;            // YYYY-MM-DD
  recovery_score: number;  // 0-100 (WHOOP)
  hrv_ms: number;
  resting_hr: number;
  spo2: number | null;
  skin_temp_c: number | null;
}

export interface SleepDay {
  date: string;
  hours: number;
  need_hours: number;
  performance_pct: number;
  efficiency_pct: number;
  rem_hours: number;
  deep_hours: number;
  light_hours: number;
  awake_hours: number;
  bedtime: string;   // HH:MM
  waketime: string;  // HH:MM
}

export interface StrainDay {
  date: string;
  strain: number;      // 0-21 (WHOOP day strain)
  calories: number;
  avg_hr: number;
  max_hr: number;
}

export interface GarminDaily {
  date: string;
  steps: number;
  body_battery: number;    // 0-100 (end-of-day high proxy)
  stress_avg: number;      // 0-100
  resting_hr: number;
  intensity_minutes: number;
  floors: number;
  calories_out: number;
  vo2max: number | null;
}

export interface RunSplit {
  km: number;
  pace_sec: number;   // sec per km for this split
  hr: number;
  elev_m: number;
}

export interface RunActivity {
  id: string;
  date: string;               // YYYY-MM-DD
  name: string;
  distance_km: number;
  duration_sec: number;
  avg_pace_sec: number;       // sec per km
  avg_hr: number;
  max_hr: number;
  cadence: number;
  elevation_gain_m: number;
  calories: number;
  training_effect: number;    // 0-5 (Garmin aerobic TE)
  splits: RunSplit[];
  hr_zones: [number, number, number, number, number]; // seconds in Z1..Z5
}

export type WorkoutType = "push" | "pull" | "legs" | "upper" | "lower" | "full" | "run" | "mobility" | "other";
export type WorkoutStatus = "planned" | "completed" | "skipped";

export interface WorkoutSet {
  reps: number;
  weight_kg: number;
  rpe?: number;
}

export interface WorkoutExercise {
  exercise_id: string;   // key into EXERCISES
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: string;
  title: string;
  type: WorkoutType;
  status: WorkoutStatus;
  exercises: WorkoutExercise[];
  duration_min: number | null;
  notes: string | null;
  source_run_id?: string | null;  // set when auto-created from a Garmin run
}

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export interface NutritionLog {
  id: string;
  date: string;
  meal: Meal;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface HydrationLog {
  id: string;
  date: string;
  ml: number;
}

export interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
}

export interface UserSettings {
  name: string;
  lat: number;
  lon: number;
  place: string;
  max_hr: number;       // for HR zone math
  targets: Targets;
}

export interface ProjectStatus {
  key: string;
  name: string;
  repo: string | null;         // owner/repo
  url: string | null;          // live site
  description: string;
  tech: string;
  live: boolean;               // repo wired up & reachable
  default_branch?: string;
  last_commit?: { message: string; author: string; date: string; sha: string } | null;
  open_prs?: number;
  open_issues?: number;
  pushed_at?: string | null;
  demo?: boolean;              // data is mocked
}

export interface WeatherNow {
  temp_c: number;
  feels_c: number;
  code: number;
  wind_kmh: number;
  humidity: number;
  is_day: boolean;
}

export interface WeatherHour { time: string; temp_c: number; code: number; precip_prob: number }
export interface WeatherDay { date: string; min_c: number; max_c: number; code: number; precip_prob: number; sunrise: string; sunset: string }

export interface WeatherBundle {
  place: string;
  now: WeatherNow;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  run_advice: string;
}
