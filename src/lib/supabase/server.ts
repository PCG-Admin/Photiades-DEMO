/* Server-side Supabase client — RLS-respecting, bound to the request's
 * session cookies. Use from Server Components, Server Actions, and Route
 * Handlers. Never use the service-role key here — RLS policies (see
 * supabase/migrations) are the actual authorization boundary. */

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types';
import { supabaseUrl, supabaseAnonKey } from './env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
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
