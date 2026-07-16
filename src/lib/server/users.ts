'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { recordAuditEvent } from '@/lib/server/audit';
import type { AppUserRow, AuditChange } from '@/lib/supabase/types';

export interface CurrentAppUser {
  id: string;
  name: string;
  email: string;
  role: AppUserRow['role'];
  dept: string;
}

// Route middleware (src/middleware.ts) already redirects unauthenticated
// visitors to /login, so this should only ever be hit with a real session.
// Kept as a defensive fallback for the edge case of a session whose
// app_users row hasn't landed yet, so the rest of the app (which expects a
// CurrentAppUser) doesn't crash. Role is deliberately the least-privileged
// one (Viewer), never Administrator — this fallback should never grant
// elevated access just because a profile row is momentarily missing.
const GUEST_USER: CurrentAppUser = {
  id: 'guest',
  name: 'Guest',
  email: '',
  role: 'Viewer',
  dept: 'Finance',
};

/** Fetches the signed-in user's app_users profile row. Falls back to
 * GUEST_USER only if the session's profile row is missing (see above). */
export async function getCurrentAppUser(): Promise<CurrentAppUser> {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return GUEST_USER;

  // .overrideTypes(...) bypasses postgrest-js's select-string type parser,
  // which resolves to `never` under the project's TypeScript 6.
  const { data: profile } = await createServiceClient()
    .from('app_users')
    .select('id, name, email, role, dept')
    .eq('id', user.id)
    .single()
    .overrideTypes<CurrentAppUser, { merge: false }>();

  return profile ?? GUEST_USER;
}

/** Throws if the signed-in user's role isn't one of `allowed`. Server
 * actions are independently invocable RPC endpoints once imported into a
 * client component — a page redirecting unauthorized visitors away
 * (requireModuleAccess) does NOT stop a client from calling the action
 * directly, so every sensitive mutation needs its own check like this one. */
export async function requireRole(...allowed: CurrentAppUser['role'][]): Promise<CurrentAppUser> {
  const user = await getCurrentAppUser();
  if (!allowed.includes(user.role)) throw new Error("You don't have permission to perform this action.");
  return user;
}

// ---- Admin CRUD (SOW §5.8 User Administration) ----

export async function listAppUsers(): Promise<AppUserRow[]> {
  const { data, error } = await createServiceClient().from('app_users').select('*').order('name')
    .overrideTypes<AppUserRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export interface NewAppUser {
  name: string;
  email: string;
  role: AppUserRow['role'];
  dept: string;
}

/** Creates a real Supabase Auth account for this person (via the admin API,
 * which the service-role client exposes) alongside the app_users directory
 * row, using the same id for both — that's what lets getCurrentAppUser()
 * find this profile once they sign in. `tempPassword` is set directly since
 * there's no email delivery configured to send an invite/reset link; the
 * person can change it later from their profile. */
export async function createAppUser(input: NewAppUser, tempPassword: string): Promise<AppUserRow> {
  await requireRole('Administrator');
  const supabase = createServiceClient();
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: input.name },
  });
  if (authError) throw authError;

  const row = { id: authUser.user.id, ...input, status: 'Active' as const, mfa_enabled: false, last_active_at: null };
  // `as never` bypasses postgrest-js's insert-argument type resolution,
  // which breaks down to `never` under the project's TypeScript 6.
  const { data, error } = await supabase
    .from('app_users')
    .insert(row as never)
    .select('*')
    .single()
    .overrideTypes<AppUserRow, { merge: false }>();
  if (error) {
    // Directory row failed — don't leave an orphaned auth account behind.
    await supabase.auth.admin.deleteUser(authUser.user.id);
    throw error;
  }
  return data;
}

/** T172 — access log: permission changes. Diffs role/status (and name/dept
 * for completeness) against the pre-update row so role/access changes show
 * up in the Audit Trail with field-level before/after, not just "updated". */
export async function updateAppUser(id: string, patch: Partial<NewAppUser & { status: AppUserRow['status'] }>): Promise<AppUserRow> {
  await requireRole('Administrator');
  const supabase = createServiceClient();
  const { data: before, error: beforeErr } = await supabase.from('app_users').select('*').eq('id', id).single()
    .overrideTypes<AppUserRow, { merge: false }>();
  if (beforeErr) throw beforeErr;

  const { data, error } = await supabase
    .from('app_users')
    .update(patch as never)
    .eq('id', id)
    .select('*')
    .single()
    .overrideTypes<AppUserRow, { merge: false }>();
  if (error) throw error;

  const changes: AuditChange[] = (['name', 'email', 'role', 'dept', 'status'] as const)
    .filter(f => patch[f] !== undefined && patch[f] !== before[f])
    .map(f => ({ field: f, before: before[f], after: data[f] }));
  if (changes.length > 0) {
    const isPermissionChange = changes.some(c => c.field === 'role' || c.field === 'status');
    await recordAuditEvent({
      action: isPermissionChange ? 'Changed user access' : 'Updated user',
      module: 'Admin', target: data.name, changes,
    });
  }

  return data;
}

/** Used by WorkflowsView's "Select user to approve" (Additional Approval). */
export async function findAppUserByName(name: string): Promise<AppUserRow | null> {
  const { data } = await createServiceClient()
    .from('app_users').select('*').eq('name', name).limit(1).maybeSingle()
    .overrideTypes<AppUserRow | null, { merge: false }>();
  return data;
}
