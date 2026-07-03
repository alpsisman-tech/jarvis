import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Admin client for API routes (WHOOP/Garmin syncs, data CRUD). Server-only —
// uses the service-role key; access is gated by requireToken() instead of RLS.
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
