import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client — SERVER ONLY. Bypasses RLS and can call the
// Auth Admin API (create/delete users). Never import this into a Client
// Component, and never expose the key to the browser.
//
// Use it only from admin-guarded Server Actions, after checking the caller is
// an admin — the service role has no per-user restrictions of its own.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env (server-only).",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
