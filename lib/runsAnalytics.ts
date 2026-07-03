// Strava-style computations over Garmin run activities.

import type { RunActivity } from "./types";
import { mondayOf } from "./format";

export interface WeeklyMileage {
  weekStart: string;   // Monday ISO
  km: number;
  runs: number;
  timeSec: number;
}

export function weeklyMileage(runs: RunActivity[]): WeeklyMileage[] {
  const map = new Map<string, WeeklyMileage>();
  for (const r of runs) {
    const wk = mondayOf(r.date);
    const cur = map.get(wk) ?? { weekStart: wk, km: 0, runs: 0, timeSec: 0 };
    cur.km += r.distance_km;
    cur.runs += 1;
    cur.timeSec += r.duration_sec;
    map.set(wk, cur);
  }
  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface PersonalRecord {
  label: string;
  paceSec: number;      // best avg pace for the distance band
  run: RunActivity;
}

// Best efforts by distance band (approximate — from whole activities, not GPS segments)
export function personalRecords(runs: RunActivity[]): PersonalRecord[] {
  const bands: [string, number, number][] = [
    ["Fastest 5K+", 5, 8],
    ["Fastest 8K+", 8, 12],
    ["Fastest 12K+", 12, 100],
    ["Longest run", 0, 1000],
  ];
  const prs: PersonalRecord[] = [];
  for (const [label, lo, hi] of bands) {
    if (label === "Longest run") {
      const longest = [...runs].sort((a, b) => b.distance_km - a.distance_km)[0];
      if (longest) prs.push({ label, paceSec: longest.avg_pace_sec, run: longest });
      continue;
    }
    const eligible = runs.filter((r) => r.distance_km >= lo && r.distance_km < hi);
    const best = [...eligible].sort((a, b) => a.avg_pace_sec - b.avg_pace_sec)[0];
    if (best) prs.push({ label, paceSec: best.avg_pace_sec, run: best });
  }
  return prs;
}

// Aggregate seconds in each HR zone across runs
export function zoneTotals(runs: RunActivity[]): number[] {
  const totals = [0, 0, 0, 0, 0];
  for (const r of runs) r.hr_zones.forEach((s, i) => (totals[i] += s));
  return totals;
}

// Simple fitness trend: rolling 4-run average pace, oldest → newest
export function paceTrend(runs: RunActivity[]): { date: string; paceSec: number }[] {
  const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((r, i) => {
    const win = sorted.slice(Math.max(0, i - 3), i + 1);
    return { date: r.date, paceSec: win.reduce((s, x) => s + x.avg_pace_sec, 0) / win.length };
  });
}
