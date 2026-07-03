/* Service-role Supabase client — bypasses RLS entirely. Server-only; never
 * import this from a module reachable from the client bundle.
 *
 * Used by every module under src/lib/server/ instead of the RLS-respecting
 * client in ./server.ts. Login now exists (src/middleware.ts gates every
 * route on a real Supabase Auth session), but data access still goes
 * through this service-role client rather than switching to per-user RLS —
 * that's a separate migration (enabling the schema's existing RLS policies
 * as the live authorization boundary, keyed off auth.uid()) not yet done.
 * Also used for the Admin API (auth.admin.createUser/deleteUser) when
 * User Administration provisions a new login. */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let client: ReturnType<typeof createSupabaseClient<Database>> | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Add it to .env.local.`);
  }
  return value;
}

export function createServiceClient() {
  if (!client) {
    client = createSupabaseClient<Database>(
      required('NEXT_PUBLIC_SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    );
  }
  return client;
}
