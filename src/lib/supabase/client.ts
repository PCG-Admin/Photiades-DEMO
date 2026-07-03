'use client';

/* Browser Supabase client — RLS-respecting, bound to the signed-in user's
 * session. Not used by any view yet (all data access this pass is
 * server-side), but available for future Client Components that need
 * realtime subscriptions. */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';
import { supabaseUrl, supabaseAnonKey } from './env';

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
