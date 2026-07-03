import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export const maxDuration = 60;

// POST /api/garmin/sync — pull recent Garmin Connect data into Supabase using
// the (optional) unofficial `garmin-connect` package + GARMIN_EMAIL/PASSWORD.
// If you prefer not to install it, push data instead via /api/garmin/ingest
// (n8n workflow "Jarvis · Garmin Sync" or any script).
export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });
  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD) {
    return NextResponse.json({ error: "GARMIN_EMAIL / GARMIN_PASSWORD not configured" }, { status: 501 });
  }

  let GarminConnect: typeof import("garmin-connect").GarminConnect;
  try {
    GarminConnect = (await import("garmin-connect")).GarminConnect;
  } catch (e) {
    return NextResponse.json(
      { error: `garmin-connect could not load (${String(e)}) — alternatively push data via /api/garmin/ingest.` },
      { status: 501 },
    );
  }

  try {
    const gc = new GarminConnect({ username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD });
    await gc.login();

    const activities = await gc.getActivities(0, 50);
    const runs = activities
      .filter((a) => String((a.activityType as { typeKey?: string })?.typeKey ?? "").includes("running"))
      .map((a) => {
        const dist_km = (Number(a.distance) || 0) / 1000;
        const dur = Number(a.duration) || 0;
        const date = String(a.startTimeLocal ?? "").slice(0, 10);
        return {
          id: `garmin-${a.activityId}`,
          date,
          name: String(a.activityName ?? "Run"),
          distance_km: Math.round(dist_km * 100) / 100,
          duration_sec: Math.round(dur),
          avg_pace_sec: dist_km > 0 ? Math.round(dur / dist_km) : 0,
          avg_hr: Math.round(Number(a.averageHR) || 0),
          max_hr: Math.round(Number(a.maxHR) || 0),
          cadence: Math.round(Number(a.averageRunningCadenceInStepsPerMinute) || 0),
          elevation_gain_m: Math.round(Number(a.elevationGain) || 0),
          calories: Math.round(Number(a.calories) || 0),
          training_effect: Math.round((Number(a.aerobicTrainingEffect) || 0) * 10) / 10,
          splits: [],
          hr_zones: [0, 0, 0, 0, 0],
        };
      })
      .filter((r) => r.date && r.distance_km > 0);

    const daily: Record<string, unknown>[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86_400_000);
      const date = d.toISOString().slice(0, 10);
      try {
        const steps = await gc.getSteps(d);
        daily.push({
          id: `garmin-daily-${date}`, date,
          steps: steps ?? 0, body_battery: 0, stress_avg: 0, resting_hr: 0,
          intensity_minutes: 0, floors: 0, calories_out: 0, vo2max: null,
        });
      } catch { /* day not available */ }
    }

    if (runs.length > 0) {
      const { error } = await db.from("garmin_runs").upsert(runs, { onConflict: "id" });
      if (error) throw new Error(`garmin_runs: ${error.message}`);
    }
    if (daily.length > 0) {
      const { error } = await db.from("garmin_daily").upsert(daily, { onConflict: "id" });
      if (error) throw new Error(`garmin_daily: ${error.message}`);
    }
    return NextResponse.json({ ok: true, runs: runs.length, daily: daily.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
