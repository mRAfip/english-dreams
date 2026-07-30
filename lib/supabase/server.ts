import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client (Server Components, Server Actions, Route Handlers).
// cookies() is async in Next 16.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore when the
            // session refresh is handled by the proxy.
          }
        },
      },
    },
  );
}
