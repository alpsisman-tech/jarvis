import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Admin client for API routes (WHOOP/Garmin syncs, data CRUD). Server-only —
// uses the service-role key; access is gated by requireToken() instead of RLS.
export function supabaseAdmin(): SupabaseClient | null {
  // Normalize to the bare project origin: tolerate a trailing slash and a
  // pasted "/rest/v1" (or any) path, which otherwise doubles up into an
  // "Invalid path specified in request URL" error.
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!raw || !key) return null;
  let url = raw;
  try {
    url = new URL(raw).origin;
  } catch {
    url = raw.replace(/\/+$/, "");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
