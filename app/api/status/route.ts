import { NextRequest, NextResponse } from "next/server";

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
  return NextResponse.json(out);
}
