import { NextRequest, NextResponse } from "next/server";
import { requireToken } from "@/lib/server/auth";
import { syncWhoop } from "@/lib/server/whoop";

export const maxDuration = 60;

// POST /api/whoop/sync — pull recent WHOOP data into Supabase.
// Called from Settings ("Sync now") or on a schedule by n8n.
export async function POST(req: NextRequest) {
  const denied = requireToken(req);
  if (denied) return denied;
  const days = Number(req.nextUrl.searchParams.get("days")) || 14;
  try {
    const result = await syncWhoop(Math.min(days, 60));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
