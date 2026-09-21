'use client';

/* Browser Supabase client — RLS-respecting, bound to the signed-in user's
 * session. Not used by any view yet (all data access this pass is
 * server-side), but available for future Client Components that need
 * realtime subscriptions. */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { supabaseUrl, supabaseAnonKey } from './env';
import { PCG_AUTH_COOKIE } from '@/lib/pcg-demos';

export function createClient() {
  // App-specific cookie name — see PCG_AUTH_COOKIE in src/lib/pcg-demos.ts.
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: { name: PCG_AUTH_COOKIE },
  });
}
