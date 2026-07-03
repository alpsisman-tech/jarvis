import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// POST /api/garmin/ingest — push Garmin data from outside (n8n workflow, a
// garth/python export script, etc). Body: { runs?: RunActivity[], daily?: GarminDaily[] }
// Rows must include an `id`; upserted on conflict.
export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  let body: { runs?: Record<string, unknown>[]; daily?: Record<string, unknown>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const out: Record<string, number> = {};
  if (Array.isArray(body.runs) && body.runs.length > 0) {
    const { error } = await db.from("garmin_runs").upsert(body.runs, { onConflict: "id" });
    if (error) return NextResponse.json({ error: `garmin_runs: ${error.message}` }, { status: 500 });
    out.runs = body.runs.length;
  }
  if (Array.isArray(body.daily) && body.daily.length > 0) {
    const { error } = await db.from("garmin_daily").upsert(body.daily, { onConflict: "id" });
    if (error) return NextResponse.json({ error: `garmin_daily: ${error.message}` }, { status: 500 });
    out.daily = body.daily.length;
  }
  return NextResponse.json({ ok: true, ...out });
}
