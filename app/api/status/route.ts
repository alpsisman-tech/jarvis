import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/supabaseAdmin";

// Public: which integrations are configured (booleans only, no secrets).
// With a bearer token, also reports whether that token is valid.
export async function GET(req: NextRequest) {
  const integrations = {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    whoop: !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET),
    garmin: !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD),
    github: !!process.env.GITHUB_TOKEN,
    n8n: !!process.env.N8N_WEBHOOK_URL,
    resend: !!process.env.RESEND_API_KEY,
  };
  const out: { cloud: boolean; integrations: typeof integrations; token_valid?: boolean } = {
    cloud: integrations.supabase && !!process.env.JARVIS_ACCESS_TOKEN,
    integrations,
  };
  const header = req.headers.get("authorization");
  if (header && process.env.JARVIS_ACCESS_TOKEN) {
    out.token_valid = header.replace(/^Bearer\s+/i, "") === process.env.JARVIS_ACCESS_TOKEN;
  }

  // Live Supabase connectivity check (?check=supabase) — surfaces the real
  // error so a misconfigured URL/key is obvious instead of silent.
  if (req.nextUrl.searchParams.get("check") === "supabase") {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const looksLikeApiUrl = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)\/?$/i.test(rawUrl.trim());
    const db = supabaseAdmin();
    let supabaseCheck: { ok: boolean; url_shape_ok: boolean; error?: string; rows?: number };
    if (!db) {
      supabaseCheck = { ok: false, url_shape_ok: looksLikeApiUrl, error: "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set" };
    } else {
      try {
        const { error, count } = await db.from("integration_tokens").select("id", { count: "exact", head: true });
        supabaseCheck = error
          ? { ok: false, url_shape_ok: looksLikeApiUrl, error: error.message }
          : { ok: true, url_shape_ok: looksLikeApiUrl, rows: count ?? 0 };
      } catch (e) {
        supabaseCheck = { ok: false, url_shape_ok: looksLikeApiUrl, error: String(e) };
      }
    }
    return NextResponse.json({ ...out, supabaseCheck, url_hint: looksLikeApiUrl ? "URL shape looks correct (https://<ref>.supabase.co)" : `URL should be https://<project-ref>.supabase.co — got: ${rawUrl.slice(0, 60)}` });
  }

  return NextResponse.json(out);
}
