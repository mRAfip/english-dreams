import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client (Client Components). Uses the publishable key,
// which is safe to expose to the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
