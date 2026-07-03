import { supabaseAdmin } from "./supabaseAdmin";

// WHOOP API v2 (developer.whoop.com). OAuth tokens live in the
// integration_tokens table; sync upserts daily rows into whoop_* tables.

const AUTH_BASE = "https://api.prod.whoop.com/oauth/oauth2";
const API_BASE = "https://api.prod.whoop.com/developer/v2";

export const WHOOP_SCOPES = "read:recovery read:sleep read:workout read:cycles read:profile offline";

// Tolerate a trailing slash in APP_URL — a doubled slash in the redirect URI
// makes WHOOP reject the authorize request.
function appUrl(): string {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

export function whoopAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID ?? "",
    redirect_uri: `${appUrl()}/api/whoop/callback`,
    response_type: "code",
    scope: WHOOP_SCOPES,
    state,
  });
  return `${AUTH_BASE}/auth?${p}`;
}

interface TokenSet { access_token: string; refresh_token: string; expires_at: string }

export async function exchangeCode(code: string): Promise<TokenSet> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.WHOOP_CLIENT_ID ?? "",
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      redirect_uri: `${appUrl()}/api/whoop/callback`,
    }),
  });
  if (!res.ok) throw new Error(`whoop token exchange ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
  };
}

export async function saveTokens(t: TokenSet): Promise<void> {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase not configured");
  const { error } = await db.from("integration_tokens").upsert(
    { id: "whoop", ...t, updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(`supabase write (integration_tokens): ${error.message} — check NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and that supabase/schema.sql was run in that project`);
}

async function freshAccessToken(): Promise<string> {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase not configured");
  const { data, error } = await db.from("integration_tokens").select("*").eq("id", "whoop").single();
  if (error || !data) throw new Error("WHOOP not authorized yet — open /api/whoop/auth first");
  if (new Date(data.expires_at).getTime() > Date.now() + 60_000) return data.access_token;

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      client_id: process.env.WHOOP_CLIENT_ID ?? "",
      client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
      scope: "offline",
    }),
  });
  if (!res.ok) throw new Error(`whoop refresh ${res.status}: ${await res.text()}`);
  const j = await res.json();
  await saveTokens({
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? data.refresh_token,
    expires_at: new Date(Date.now() + (j.expires_in ?? 3600) * 1000).toISOString(),
  });
  return j.access_token;
}

async function paged(path: string, token: string, start: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let next: string | undefined;
  for (let page = 0; page < 6; page++) {
    const p = new URLSearchParams({ start, limit: "25" });
    if (next) p.set("nextToken", next);
    const res = await fetch(`${API_BASE}${path}?${p}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`whoop ${path} ${res.status}: ${await res.text()}`);
    const j = await res.json();
    out.push(...(j.records ?? []));
    next = j.next_token ?? undefined;
    if (!next) break;
  }
  return out;
}

const day = (iso: string) => iso.slice(0, 10);
const ms2h = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;

export async function syncWhoop(days = 14): Promise<{ recovery: number; sleep: number; strain: number }> {
  const db = supabaseAdmin();
  if (!db) throw new Error("supabase not configured");
  const token = await freshAccessToken();
  const start = new Date(Date.now() - days * 86_400_000).toISOString();

  const [recoveries, sleeps, cycles] = await Promise.all([
    paged("/recovery", token, start),
    paged("/activity/sleep", token, start),
    paged("/cycle", token, start),
  ]);

  const recRows = recoveries
    .filter((r) => (r as { score_state?: string }).score_state === "SCORED")
    .map((r) => {
      const rec = r as { created_at: string; score: { recovery_score: number; hrv_rmssd_milli: number; resting_heart_rate: number; spo2_percentage?: number; skin_temp_celsius?: number } };
      return {
        id: `whoop-rec-${day(rec.created_at)}`,
        date: day(rec.created_at),
        recovery_score: Math.round(rec.score.recovery_score),
        hrv_ms: Math.round(rec.score.hrv_rmssd_milli),
        resting_hr: Math.round(rec.score.resting_heart_rate),
        spo2: rec.score.spo2_percentage ?? null,
        skin_temp_c: rec.score.skin_temp_celsius ?? null,
      };
    });

  const sleepRows = sleeps
    .filter((s) => !(s as { nap?: boolean }).nap && (s as { score?: unknown }).score)
    .map((s) => {
      const sl = s as {
        start: string; end: string;
        score: {
          stage_summary: { total_in_bed_time_milli: number; total_awake_time_milli: number; total_light_sleep_time_milli: number; total_slow_wave_sleep_time_milli: number; total_rem_sleep_time_milli: number };
          sleep_needed: { baseline_milli: number };
          sleep_performance_percentage?: number; sleep_efficiency_percentage?: number;
        };
      };
      const st = sl.score.stage_summary;
      const asleep = st.total_light_sleep_time_milli + st.total_slow_wave_sleep_time_milli + st.total_rem_sleep_time_milli;
      return {
        id: `whoop-sleep-${day(sl.end)}`,
        date: day(sl.end),
        hours: ms2h(asleep),
        need_hours: ms2h(sl.score.sleep_needed.baseline_milli),
        performance_pct: Math.round(sl.score.sleep_performance_percentage ?? 0),
        efficiency_pct: Math.round(sl.score.sleep_efficiency_percentage ?? 0),
        rem_hours: ms2h(st.total_rem_sleep_time_milli),
        deep_hours: ms2h(st.total_slow_wave_sleep_time_milli),
        light_hours: ms2h(st.total_light_sleep_time_milli),
        awake_hours: ms2h(st.total_awake_time_milli),
        bedtime: sl.start.slice(11, 16),
        waketime: sl.end.slice(11, 16),
      };
    });

  const strainRows = cycles
    .filter((cy) => (cy as { score?: unknown }).score)
    .map((cy) => {
      const cyc = cy as { start: string; score: { strain: number; kilojoule: number; average_heart_rate: number; max_heart_rate: number } };
      return {
        id: `whoop-strain-${day(cyc.start)}`,
        date: day(cyc.start),
        strain: Math.round(cyc.score.strain * 10) / 10,
        calories: Math.round(cyc.score.kilojoule / 4.184),
        avg_hr: Math.round(cyc.score.average_heart_rate),
        max_hr: Math.round(cyc.score.max_heart_rate),
      };
    });

  const upsert = async (tbl: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const { error } = await db.from(tbl).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`${tbl}: ${error.message}`);
  };
  await upsert("whoop_recovery", recRows);
  await upsert("whoop_sleep", sleepRows);
  await upsert("whoop_strain", strainRows);
  return { recovery: recRows.length, sleep: sleepRows.length, strain: strainRows.length };
}
