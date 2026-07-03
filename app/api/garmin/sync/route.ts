import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

export const maxDuration = 60;

interface GC {
  login: () => Promise<unknown>;
  getActivities: (start: number, limit: number) => Promise<Record<string, unknown>[]>;
  exportToken?: () => { oauth1: unknown; oauth2: unknown };
  loadToken?: (oauth1: unknown, oauth2: unknown) => void;
}

// De-dupe rows by id (last wins) so a batch never triggers Postgres's
// "ON CONFLICT DO UPDATE cannot affect row a second time".
function dedupe<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of rows) byId.set(r.id, r);
  return [...byId.values()];
}

function mapActivityToRun(a: Record<string, unknown>) {
  const dist_km = (Number(a.distance) || 0) / 1000;
  const dur = Number(a.duration) || 0;
  const date = String(a.startTimeLocal ?? a.start_time_local ?? "").slice(0, 10);
  return {
    id: `garmin-${a.activityId ?? a.activity_id}`,
    date,
    name: String(a.activityName ?? a.activity_name ?? "Run"),
    distance_km: Math.round(dist_km * 100) / 100,
    duration_sec: Math.round(dur),
    avg_pace_sec: dist_km > 0 ? Math.round(dur / dist_km) : 0,
    avg_hr: Math.round(Number(a.averageHR ?? a.average_hr) || 0),
    max_hr: Math.round(Number(a.maxHR ?? a.max_hr) || 0),
    cadence: Math.round(Number(a.averageRunningCadenceInStepsPerMinute ?? a.cadence) || 0),
    elevation_gain_m: Math.round(Number(a.elevationGain ?? a.elevation_gain) || 0),
    calories: Math.round(Number(a.calories) || 0),
    training_effect: Math.round((Number(a.aerobicTrainingEffect ?? a.training_effect) || 0) * 10) / 10,
    splits: [],
    hr_zones: [0, 0, 0, 0, 0],
  };
}

function isRunning(a: Record<string, unknown>): boolean {
  const t = (a.activityType as { typeKey?: string })?.typeKey ?? a.activity_type ?? a.sport ?? "";
  return String(t).toLowerCase().includes("run");
}

// POST /api/garmin/sync — three independent strategies, best-effort each:
//  1. Railway shim (GARMIN_SHIM_URL/SECRET): Garmin Coach scheduled runs →
//     planned workouts. Works from datacenter IPs; this is the reliable path.
//  2. Shim /garmin/activities if that endpoint ever exists (future-proof).
//  3. Direct garmin-connect login (GARMIN_EMAIL/PASSWORD) for run history.
//     Garmin aggressively blocks cloud IPs, so this may fail persistently —
//     that failure no longer sinks the whole sync.
export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  const shimUrl = (process.env.GARMIN_SHIM_URL ?? "").replace(/\/+$/, "");
  const shimSecret = process.env.GARMIN_SHIM_SECRET ?? "";
  const haveShim = !!(shimUrl && shimSecret);
  const haveCreds = !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD);
  if (!haveShim && !haveCreds) {
    return NextResponse.json({ error: "Configure GARMIN_SHIM_URL + GARMIN_SHIM_SECRET (recommended) or GARMIN_EMAIL/GARMIN_PASSWORD" }, { status: 501 });
  }

  const result: Record<string, unknown> = { ok: true };
  const today = new Date().toISOString().slice(0, 10);

  // ── 1. Coach plan via shim ─────────────────────────────────────────────
  if (haveShim) {
    try {
      const res = await fetch(`${shimUrl}/garmin/scheduled-runs`, {
        headers: { "X-Shim-Secret": shimSecret },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`shim ${res.status}`);
      const j = await res.json();
      const runs: { date?: string; title?: string; type?: string; workoutUuid?: string }[] = j.runs ?? [];
      const rows = runs
        .filter((r) => r.date && r.date >= today)
        .map((r) => ({
          id: `garmin-plan-${r.workoutUuid ?? r.date}`,
          date: r.date!,
          title: `${r.title ?? r.type ?? "Run"} run`,
          type: "run",
          status: "planned",
          exercises: [],
          duration_min: null,
          notes: `Garmin Coach · ${r.type ?? ""}`.trim(),
        }));
      const deduped = dedupe(rows);
      if (deduped.length > 0) {
        const { error } = await db.from("workouts").upsert(deduped, { onConflict: "id" });
        if (error) throw new Error(error.message);
      }
      result.coach_runs_planned = deduped.length;
    } catch (e) {
      result.coach_error = String(e).slice(0, 160);
    }

    // ── 2. Activities via shim (endpoint may not exist yet — that's fine) ──
    try {
      const res = await fetch(`${shimUrl}/garmin/activities`, {
        headers: { "X-Shim-Secret": shimSecret },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const j = await res.json();
        const list: Record<string, unknown>[] = Array.isArray(j) ? j : j.activities ?? [];
        const runRows = dedupe(list.filter(isRunning).map(mapActivityToRun).filter((r) => r.date && r.distance_km > 0));
        if (runRows.length > 0) {
          const { error } = await db.from("garmin_runs").upsert(runRows, { onConflict: "id" });
          if (!error) result.shim_activities = runRows.length;
        }
      }
    } catch { /* endpoint not implemented on the shim — expected */ }
  }

  // ── 3. Run history via direct login (best-effort) ─────────────────────
  if (haveCreds) {
    try {
      const { GarminConnect } = (await import("garmin-connect")) as unknown as {
        GarminConnect: new (a: { username: string; password: string }) => GC;
      };
      const creds = { username: process.env.GARMIN_EMAIL!, password: process.env.GARMIN_PASSWORD! };
      let gc = new GarminConnect(creds);
      let usedCachedSession = false;

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
        if (!usedCachedSession) throw e;
        gc = new GarminConnect(creds);
        await gc.login();
        activities = await gc.getActivities(0, 60);
        usedCachedSession = false;
      }

      try {
        const tok = gc.exportToken?.();
        if (tok) {
          await db.from("integration_tokens").upsert(
            { id: "garmin", access_token: JSON.stringify(tok), refresh_token: null, expires_at: null, updated_at: new Date().toISOString() },
            { onConflict: "id" },
          );
        }
      } catch { /* best-effort */ }

      const runRows = dedupe(activities.filter(isRunning).map(mapActivityToRun).filter((r) => r.date && r.distance_km > 0));
      if (runRows.length > 0) {
        const { error } = await db.from("garmin_runs").upsert(runRows, { onConflict: "id" });
        if (error) throw new Error(`garmin_runs: ${error.message}`);
      }
      result.activities = runRows.length;
      result.session = usedCachedSession ? "cached" : "fresh login";

      // Mirror completed runs onto the training calendar (skip dates already
      // covered by a run entry, e.g. from WHOOP or the coach plan).
      const runDates = runRows.map((r) => r.date);
      if (runDates.length > 0) {
        const { data: existing } = await db.from("workouts").select("id,date,type").in("date", runDates);
        const covered = new Set((existing ?? []).filter((w: { type: string }) => w.type === "run").map((w: { date: string }) => w.date));
        const mirrorRows = dedupe(runRows.filter((r) => !covered.has(r.date)).map((r) => ({
          id: `garmin-wk-${r.id}`,
          date: r.date,
          title: r.name,
          type: "run",
          status: "completed",
          exercises: [],
          duration_min: Math.round(r.duration_sec / 60),
          notes: `Garmin · ${r.distance_km} km`,
          source_run_id: r.id,
        })));
        if (mirrorRows.length > 0) {
          const { error } = await db.from("workouts").upsert(mirrorRows, { onConflict: "id" });
          if (!error) result.calendar_runs_added = mirrorRows.length;
        }
      }
    } catch (e) {
      const msg = String(e);
      result.activities_error = /429|too many/i.test(msg)
        ? "Garmin is blocking logins from this server (cloud IPs are throttled hard — this may persist). Coach plan still syncs via the shim; run history will use the shim's /garmin/activities endpoint if you add one."
        : msg.slice(0, 200);
    }
  }

  // The sync "succeeded" if any strategy produced data
  const produced = ["coach_runs_planned", "shim_activities", "activities"].some((k) => Number(result[k]) > 0);
  if (!produced && (result.coach_error || result.activities_error)) {
    return NextResponse.json({ ok: false, ...result }, { status: 502 });
  }
  return NextResponse.json(result);
}
