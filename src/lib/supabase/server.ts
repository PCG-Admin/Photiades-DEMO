/* Server-side Supabase client — RLS-respecting, bound to the request's
 * session cookies. Use from Server Components, Server Actions, and Route
 * Handlers. Never use the service-role key here — RLS policies (see
 * supabase/migrations) are the actual authorization boundary. */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';
import { supabaseUrl, supabaseAnonKey } from './env';
import { PCG_AUTH_COOKIE } from '@/lib/pcg-demos';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    // Must match client.ts and middleware.ts or the session is invisible.
    cookieOptions: { name: PCG_AUTH_COOKIE },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (not a Server Action/Route
          // Handler) — cookies are read-only there. Session refresh for
          // Server Components is instead handled by src/middleware.ts.
        }
      },
    },
  });
}
