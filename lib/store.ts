// Data access layer. Two modes:
//  - "local" (default): deterministic demo data + a localStorage overlay for
//    everything the user creates/edits. Fully offline, zero setup.
//  - "cloud": reads/writes go to /api/data/* (Supabase behind a bearer token),
//    which the WHOOP/Garmin/n8n syncs also write into.
// Every page talks to this module only — never to Supabase or demo data directly.

import type {
  RecoveryDay, SleepDay, StrainDay, GarminDaily, RunActivity, Workout,
  NutritionLog, HydrationLog, UserSettings,
} from "./types";
import {
  DEMO_RECOVERY, DEMO_SLEEP, DEMO_STRAIN, DEMO_GARMIN_DAILY, DEMO_RUNS,
  DEMO_WORKOUTS, DEMO_NUTRITION, DEMO_HYDRATION,
} from "./demoData";
import { daysAgoISO } from "./format";

const LS = {
  mode: "jarvis-mode",
  token: "jarvis-token",
  settings: "jarvis-settings",
  workouts: "jarvis-local-workouts",
  nutrition: "jarvis-local-nutrition",
  hydration: "jarvis-local-hydration",
  deleted: "jarvis-local-deleted",
};

const isBrowser = typeof window !== "undefined";

export function getMode(): "local" | "cloud" {
  if (!isBrowser) return "local";
  return localStorage.getItem(LS.mode) === "cloud" ? "cloud" : "local";
}

export function setMode(mode: "local" | "cloud") {
  localStorage.setItem(LS.mode, mode);
}

export function getToken(): string {
  return isBrowser ? localStorage.getItem(LS.token) ?? "" : "";
}

export function setToken(t: string) {
  localStorage.setItem(LS.token, t);
}

function readLS<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (isBrowser) localStorage.setItem(key, JSON.stringify(value));
}

async function cloud<T>(resource: string, params?: Record<string, string>, init?: RequestInit): Promise<T> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`/api/data/${resource}${qs}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getToken()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${resource}: ${res.status} ${await res.text()}`);
  return res.json();
}

function inRange<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((r) => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Read: physiology / activity (WHOOP + Garmin) ────────────────────────────

export async function getRecovery(days: number): Promise<RecoveryDay[]> {
  const from = daysAgoISO(days - 1), to = daysAgoISO(0);
  if (getMode() === "cloud") {
    try { return await cloud<RecoveryDay[]>("recovery", { from, to }); } catch { /* fall through to demo */ }
  }
  return inRange(DEMO_RECOVERY, from, to);
}

export async function getSleep(days: number): Promise<SleepDay[]> {
  const from = daysAgoISO(days - 1), to = daysAgoISO(0);
  if (getMode() === "cloud") {
    try { return await cloud<SleepDay[]>("sleep", { from, to }); } catch { /* noop */ }
  }
  return inRange(DEMO_SLEEP, from, to);
}

export async function getStrain(days: number): Promise<StrainDay[]> {
  const from = daysAgoISO(days - 1), to = daysAgoISO(0);
  if (getMode() === "cloud") {
    try { return await cloud<StrainDay[]>("strain", { from, to }); } catch { /* noop */ }
  }
  return inRange(DEMO_STRAIN, from, to);
}

export async function getGarminDaily(days: number): Promise<GarminDaily[]> {
  const from = daysAgoISO(days - 1), to = daysAgoISO(0);
  if (getMode() === "cloud") {
    try { return await cloud<GarminDaily[]>("garmin_daily", { from, to }); } catch { /* noop */ }
  }
  return inRange(DEMO_GARMIN_DAILY, from, to);
}

export async function getRuns(days: number): Promise<RunActivity[]> {
  const from = daysAgoISO(days - 1), to = daysAgoISO(0);
  if (getMode() === "cloud") {
    try { return await cloud<RunActivity[]>("runs", { from, to }); } catch { /* noop */ }
  }
  return inRange(DEMO_RUNS, from, to);
}

// ── Workouts (read + write) ─────────────────────────────────────────────────

function localWorkouts(): Workout[] {
  const overrides = readLS<Workout[]>(LS.workouts, []);
  const deleted = new Set(readLS<string[]>(LS.deleted, []));
  const byId = new Map<string, Workout>();
  for (const w of DEMO_WORKOUTS) byId.set(w.id, w);
  for (const w of overrides) byId.set(w.id, w);
  return [...byId.values()].filter((w) => !deleted.has(w.id));
}

export async function getWorkouts(from: string, to: string): Promise<Workout[]> {
  if (getMode() === "cloud") {
    try { return await cloud<Workout[]>("workouts", { from, to }); } catch { /* noop */ }
  }
  return inRange(localWorkouts(), from, to);
}

export async function saveWorkout(w: Workout): Promise<void> {
  if (getMode() === "cloud") {
    await cloud("workouts", undefined, { method: "POST", body: JSON.stringify(w) });
    return;
  }
  const overrides = readLS<Workout[]>(LS.workouts, []).filter((x) => x.id !== w.id);
  overrides.push(w);
  writeLS(LS.workouts, overrides);
  const deleted = readLS<string[]>(LS.deleted, []).filter((id) => id !== w.id);
  writeLS(LS.deleted, deleted);
}

export async function deleteWorkout(id: string): Promise<void> {
  if (getMode() === "cloud") {
    await cloud(`workouts`, { id }, { method: "DELETE" });
    return;
  }
  writeLS(LS.workouts, readLS<Workout[]>(LS.workouts, []).filter((x) => x.id !== id));
  const deleted = readLS<string[]>(LS.deleted, []);
  if (!deleted.includes(id)) { deleted.push(id); writeLS(LS.deleted, deleted); }
}

// ── Nutrition & hydration ───────────────────────────────────────────────────

export async function getNutrition(from: string, to: string): Promise<NutritionLog[]> {
  if (getMode() === "cloud") {
    try { return await cloud<NutritionLog[]>("nutrition", { from, to }); } catch { /* noop */ }
  }
  const deleted = new Set(readLS<string[]>(LS.deleted, []));
  const all = [...DEMO_NUTRITION, ...readLS<NutritionLog[]>(LS.nutrition, [])].filter((n) => !deleted.has(n.id));
  return inRange(all, from, to);
}

export async function logNutrition(n: NutritionLog): Promise<void> {
  if (getMode() === "cloud") {
    await cloud("nutrition", undefined, { method: "POST", body: JSON.stringify(n) });
    return;
  }
  const rows = readLS<NutritionLog[]>(LS.nutrition, []).filter((x) => x.id !== n.id);
  rows.push(n);
  writeLS(LS.nutrition, rows);
}

export async function deleteNutrition(id: string): Promise<void> {
  if (getMode() === "cloud") {
    await cloud("nutrition", { id }, { method: "DELETE" });
    return;
  }
  writeLS(LS.nutrition, readLS<NutritionLog[]>(LS.nutrition, []).filter((x) => x.id !== id));
  const deleted = readLS<string[]>(LS.deleted, []);
  if (!deleted.includes(id)) { deleted.push(id); writeLS(LS.deleted, deleted); }
}

export async function getHydration(from: string, to: string): Promise<HydrationLog[]> {
  if (getMode() === "cloud") {
    try { return await cloud<HydrationLog[]>("hydration", { from, to }); } catch { /* noop */ }
  }
  return inRange([...DEMO_HYDRATION, ...readLS<HydrationLog[]>(LS.hydration, [])], from, to);
}

export async function logHydration(h: HydrationLog): Promise<void> {
  if (getMode() === "cloud") {
    await cloud("hydration", undefined, { method: "POST", body: JSON.stringify(h) });
    return;
  }
  const rows = readLS<HydrationLog[]>(LS.hydration, []);
  rows.push(h);
  writeLS(LS.hydration, rows);
}

// ── Settings ────────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: UserSettings = {
  name: "Alp",
  lat: 41.015, lon: 28.979, place: "Istanbul",
  max_hr: 192,
  targets: { calories: 2600, protein_g: 170, carbs_g: 290, fat_g: 80, water_ml: 3000 },
};

export function getSettings(): UserSettings {
  return { ...DEFAULT_SETTINGS, ...readLS<Partial<UserSettings>>(LS.settings, {}) };
}

export function saveSettings(s: UserSettings) {
  writeLS(LS.settings, s);
}
