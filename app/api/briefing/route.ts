import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";
import { fetchWeather } from "@/lib/server/weather";

export const maxDuration = 60;

async function latest(db: NonNullable<ReturnType<typeof supabaseAdmin>>, table: string) {
  const { data } = await db.from(table).select("*").order("date", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

async function composeBriefing(): Promise<{ subject: string; text: string }> {
  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [`JARVIS morning briefing — ${today}`, ""];

  if (db) {
    const [rec, sleep, strain, garmin] = await Promise.all([
      latest(db, "whoop_recovery"), latest(db, "whoop_sleep"),
      latest(db, "whoop_strain"), latest(db, "garmin_daily"),
    ]);
    if (rec) lines.push(`Recovery: ${rec.recovery_score}% · HRV ${rec.hrv_ms}ms · RHR ${rec.resting_hr}bpm (${rec.date})`);
    if (sleep) lines.push(`Sleep: ${sleep.hours}h (${sleep.performance_pct}% of need)`);
    if (strain) lines.push(`Yesterday's strain: ${strain.strain}`);
    if (garmin) lines.push(`Garmin: ${garmin.steps} steps · body battery ${garmin.body_battery}`);
    const { data: todaysWorkouts } = await db.from("workouts").select("*").eq("date", today);
    if (todaysWorkouts && todaysWorkouts.length > 0) {
      lines.push("", `Today's plan: ${todaysWorkouts.map((w: { title: string }) => w.title).join(", ")}`);
    } else {
      lines.push("", "Nothing on the training calendar today.");
    }
  } else {
    lines.push("(No Supabase configured — health data unavailable to the server.)");
  }

  try {
    const w = await fetchWeather(41.015, 28.979, "Istanbul");
    lines.push("", `Weather: ${Math.round(w.now.temp_c)}°C now, ${Math.round(w.daily[0].min_c)}–${Math.round(w.daily[0].max_c)}° today, precip ${w.daily[0].precip_prob}%`);
    lines.push(`Run check: ${w.run_advice}`);
  } catch { /* weather is best-effort */ }

  return { subject: `JARVIS briefing · ${today}`, text: lines.join("\n") };
}

// GET → briefing JSON (for n8n or the app). POST → also email it via Resend.
export async function GET(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  return NextResponse.json(await composeBriefing());
}

export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const briefing = await composeBriefing();
  const key = process.env.RESEND_API_KEY;
  const to = process.env.BRIEFING_TO;
  if (!key || !to) {
    return NextResponse.json({ error: "RESEND_API_KEY / BRIEFING_TO not configured", briefing }, { status: 501 });
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "jarvis@resend.dev",
      to: [to],
      subject: briefing.subject,
      text: briefing.text,
    }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: `resend ${res.status}: ${await res.text()}` }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent_to: to });
}
