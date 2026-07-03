-- JARVIS Supabase schema. Run in the SQL editor of a Supabase project, then
-- set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the server.
-- Access goes exclusively through the app's API routes (service role +
-- JARVIS_ACCESS_TOKEN); RLS is enabled with no policies so the anon key
-- can't read anything.

create table if not exists integration_tokens (
  id text primary key,              -- 'whoop', ...
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists whoop_recovery (
  id text primary key,              -- whoop-rec-YYYY-MM-DD
  date date not null,
  recovery_score int not null,
  hrv_ms int not null,
  resting_hr int not null,
  spo2 numeric,
  skin_temp_c numeric
);
create index if not exists whoop_recovery_date on whoop_recovery (date);

create table if not exists whoop_sleep (
  id text primary key,
  date date not null,
  hours numeric not null,
  need_hours numeric,
  performance_pct int,
  efficiency_pct int,
  rem_hours numeric,
  deep_hours numeric,
  light_hours numeric,
  awake_hours numeric,
  bedtime text,
  waketime text
);
create index if not exists whoop_sleep_date on whoop_sleep (date);

create table if not exists whoop_strain (
  id text primary key,
  date date not null,
  strain numeric not null,
  calories int,
  avg_hr int,
  max_hr int
);
create index if not exists whoop_strain_date on whoop_strain (date);

create table if not exists garmin_daily (
  id text primary key,              -- garmin-daily-YYYY-MM-DD
  date date not null,
  steps int default 0,
  body_battery int default 0,
  stress_avg int default 0,
  resting_hr int default 0,
  intensity_minutes int default 0,
  floors int default 0,
  calories_out int default 0,
  vo2max numeric
);
create index if not exists garmin_daily_date on garmin_daily (date);

create table if not exists garmin_runs (
  id text primary key,              -- garmin-<activityId>
  date date not null,
  name text not null,
  distance_km numeric not null,
  duration_sec int not null,
  avg_pace_sec int not null,
  avg_hr int,
  max_hr int,
  cadence int,
  elevation_gain_m int,
  calories int,
  training_effect numeric,
  splits jsonb default '[]',        -- [{km, pace_sec, hr, elev_m}]
  hr_zones jsonb default '[0,0,0,0,0]'
);
create index if not exists garmin_runs_date on garmin_runs (date);

create table if not exists workouts (
  id text primary key,
  date date not null,
  title text not null,
  type text not null,               -- push/pull/legs/upper/lower/full/run/mobility/other
  status text not null default 'planned',
  exercises jsonb default '[]',     -- [{exercise_id, sets: [{reps, weight_kg, rpe}]}]
  duration_min int,
  notes text,
  source_run_id text
);
create index if not exists workouts_date on workouts (date);

create table if not exists nutrition_logs (
  id text primary key,
  date date not null,
  meal text not null,
  name text not null,
  calories int not null default 0,
  protein_g int not null default 0,
  carbs_g int not null default 0,
  fat_g int not null default 0
);
create index if not exists nutrition_logs_date on nutrition_logs (date);

create table if not exists hydration_logs (
  id text primary key,
  date date not null,
  ml int not null
);
create index if not exists hydration_logs_date on hydration_logs (date);

-- Lock everything down: RLS on, no policies. Only the service-role key
-- (server API routes) can touch these tables.
alter table integration_tokens enable row level security;
alter table whoop_recovery enable row level security;
alter table whoop_sleep enable row level security;
alter table whoop_strain enable row level security;
alter table garmin_daily enable row level security;
alter table garmin_runs enable row level security;
alter table workouts enable row level security;
alter table nutrition_logs enable row level security;
alter table hydration_logs enable row level security;
