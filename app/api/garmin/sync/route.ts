import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export const maxDuration = 60;

interface GC {
  login: () => Promise<unknown>;
  getActivities: (start: number, limit: number) => Promise<Record<string, unknown>[]>;
  exportToken?: () => { oauth1: unknown; oauth2: unknown };
  loadToken?: (oauth1: unknown, oauth2: unknown) => void;
  get?: <T>(url: string) => Promise<T>;
}

// De-dupe rows by id (last wins) so a batch never triggers Postgres's
// "ON CONFLICT DO UPDATE cannot affect row a second time".
function dedupe<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()];
}

function friendly(e: unknown): NextResponse {
  const msg = String(e);
  if (/429|too many/i.test(msg)) {
    return NextResponse.json(
      { error: "Garmin is rate-limiting logins right now — wait 30–60 minutes and sync again. The session is cached after a successful login, so this shouldn't happen twice." },
      { status: 429 },
    );
  }
  if (/401|credential|password|MFA|mfa/i.test(msg)) {
    return NextResponse.json(
      { error: `Garmin login failed — check GARMIN_EMAIL/GARMIN_PASSWORD (and note that 2FA-protected accounts can't use this sync): ${msg.slice(0, 160)}` },
      { status: 401 },
    );
  }
  return NextResponse.json({ error: msg.slice(0, 300) }, { status: 500 });
}

// POST /api/garmin/sync — pull Garmin runs + AI-coach/scheduled workouts.
// The Garmin session is cached in integration_tokens to avoid re-login
// rate limits (429). Daily wellness stats are intentionally NOT pulled —
// WHOOP is the primary daily-health source; Garmin covers running only.
export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });
  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD) {
    return NextResponse.json({ error: "GARMIN_EMAIL / GARMIN_PASSWORD not configured" }, { status: 501 });
  }

  let GarminConnect: new (a: { username: string; password: string }) => GC;
  try {
    GarminConnect = (await import("garmin-connect")).GarminConnect as unknown as typeof GarminConnect;
  } catch (e) {
    return NextResponse.json({ error: `garmin-connect could not load (${String(e)})` }, { status: 501 });
  }

  const creds = { username: process.env.GARMIN_EMAIL, password: process.env.GARMIN_PASSWORD };
  let gc = new GarminConnect(creds);
  let usedCachedSession = false;

  // Restore a cached session if we have one
  try {
    const { data } = await db.from("integration_tokens").select("*").eq("id", "garmin").single();
    if (data?.access_token && gc.loadToken) {
      const t = JSON.parse(data.access_token);
      gc.loadToken(t.oauth1, t.oauth2);
      usedCachedSession = true;
    }
  } catch { /* no cached session yet */ }

  let activities: Record<string, unknown>[];
  try {
    if (!usedCachedSession) await gc.login();
    activities = await gc.getActivities(0, 60);
  } catch (e) {
    if (!usedCachedSession) return friendly(e);
    // Cached session went stale — one fresh login attempt
    try {
      gc = new GarminConnect(creds);
      await gc.login();
      activities = await gc.getActivities(0, 60);
    } catch (e2) {
      return friendly(e2);
    }
  }

  // Cache the (possibly refreshed) session for next time
  try {
    const tok = gc.exportToken?.();
    if (tok) {
      await db.from("integration_tokens").upsert(
        { id: "garmin", access_token: JSON.stringify(tok), refresh_token: null, expires_at: null, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    }
  } catch { /* best-effort */ }

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

  const runRows = dedupe(runs);
  if (runRows.length > 0) {
    const { error } = await db.from("garmin_runs").upsert(runRows, { onConflict: "id" });
    if (error) return NextResponse.json({ error: `garmin_runs: ${error.message}` }, { status: 500 });
  }

  // Mirror completed Garmin runs onto the training calendar (skip any date
  // already covered by a WHOOP-tracked run to avoid doubles).
  let mirrored = 0;
  try {
    const runDates = runs.map((r) => r.date);
    const { data: existing } = await db.from("workouts").select("id,date,type").in("date", runDates.length ? runDates : ["1970-01-01"]);
    const covered = new Set((existing ?? []).filter((w: { type: string }) => w.type === "run").map((w: { date: string }) => w.date));
    const mirrorRows = runs
      .filter((r) => !covered.has(r.date))
      .map((r) => ({
        id: `garmin-wk-${r.id}`,
        date: r.date,
        title: r.name,
        type: "run",
        status: "completed",
        exercises: [],
        duration_min: Math.round(r.duration_sec / 60),
        notes: `Garmin · ${r.distance_km} km`,
        source_run_id: r.id,
      }));
    const mirrorDeduped = dedupe(mirrorRows);
    if (mirrorDeduped.length > 0) {
      const { error } = await db.from("workouts").upsert(mirrorDeduped, { onConflict: "id" });
      if (!error) mirrored = mirrorDeduped.length;
    }
  } catch { /* best-effort */ }

  // Garmin Coach / scheduled workouts from the Connect calendar → planned
  // sessions. Endpoint is unofficial; failures are reported, not fatal.
  let planned = 0;
  let calendarNote: string | undefined;
  try {
    if (!gc.get) throw new Error("client has no raw GET");
    const today = new Date().toISOString().slice(0, 10);
    const rows: Record<string, unknown>[] = [];
    for (const monthOffset of [0, 1]) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + monthOffset);
      const cal = await gc.get<{ calendarItems?: Record<string, unknown>[] }>(
        `https://connectapi.garmin.com/calendar-service/year/${d.getFullYear()}/month/${d.getMonth()}`,
      );
      for (const it of cal?.calendarItems ?? []) {
        const itemType = String(it.itemType ?? "");
        const date = String(it.date ?? "").slice(0, 10);
        if (itemType !== "workout" || !date || date < today) continue;
        rows.push({
          id: `garmin-plan-${it.id ?? `${date}-${it.title}`}`,
          date,
          title: String(it.title ?? "Garmin workout"),
          type: /run/i.test(String(it.sportTypeKey ?? it.workoutSportType ?? "running")) ? "run" : "other",
          status: "planned",
          exercises: [],
          duration_min: null,
          notes: "Garmin Coach",
        });
      }
    }
    const plannedRows = dedupe(rows as { id: string }[]);
    if (plannedRows.length > 0) {
      const { error } = await db.from("workouts").upsert(plannedRows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      planned = plannedRows.length;
    }
  } catch (e) {
    calendarNote = `coach calendar not available: ${String(e).slice(0, 120)}`;
  }

  return NextResponse.json({
    ok: true,
    runs: runs.length,
    calendar_runs_added: mirrored,
    coach_workouts_planned: planned,
    session: usedCachedSession ? "cached" : "fresh login",
    ...(calendarNote ? { note: calendarNote } : {}),
  });
}
