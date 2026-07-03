import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// Generic CRUD over the Supabase tables (cloud mode). Table names are
// allowlisted; every request needs the bearer token.
const TABLES: Record<string, string> = {
  recovery: "whoop_recovery",
  sleep: "whoop_sleep",
  strain: "whoop_strain",
  garmin_daily: "garmin_daily",
  runs: "garmin_runs",
  workouts: "workouts",
  nutrition: "nutrition_logs",
  hydration: "hydration_logs",
};

function table(resource: string): string | null {
  return TABLES[resource] ?? null;
}

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = requireToken(req);
  if (denied) return denied;
  const { resource } = await ctx.params;
  const t = table(resource);
  if (!t) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  const sp = req.nextUrl.searchParams;
  let q = db.from(t).select("*").order("date", { ascending: true }).limit(2000);
  const from = sp.get("from"), to = sp.get("to");
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const denied = requireToken(req);
  if (denied) return denied;
  const { resource } = await ctx.params;
  const t = table(resource);
  if (!t) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  let body: Record<string, unknown> | Record<string, unknown>[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const rows = Array.isArray(body) ? body : [body];
  const { error } = await db.from(t).upsert(rows, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = requireToken(req);
  if (denied) return denied;
  const { resource } = await ctx.params;
  const t = table(resource);
  if (!t) return NextResponse.json({ error: "unknown resource" }, { status: 404 });
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 501 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await db.from(t).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
