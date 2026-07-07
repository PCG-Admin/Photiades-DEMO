'use server';

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { recordAuditEvent } from '@/lib/server/audit';
import { getCurrentAppUser } from '@/lib/server/users';
import type { RolePermissionRow, PortalModule, AppUserRow } from '@/lib/supabase/types';

export async function listRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await createServiceClient().from('role_permissions').select('*').order('role').order('module')
    .overrideTypes<RolePermissionRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

/** Administrators always get every module — enforced here, not via the
 * seeded data, so toggling this matrix can never lock the admin role itself
 * out of the portal. */
export async function setRolePermission(role: AppUserRow['role'], module: PortalModule, canAccess: boolean): Promise<void> {
  if (role === 'Administrator') return;
  const { error } = await createServiceClient().from('role_permissions')
    .upsert({ role, module, can_access: canAccess } as never, { onConflict: 'role,module' });
  if (error) throw error;
  await recordAuditEvent({
    action: `${canAccess ? 'Granted' : 'Revoked'} ${module} access for ${role}`,
    module: 'Admin',
    changes: [{ field: `${role}.${module}`, before: !canAccess, after: canAccess }],
  });
}

/** Modules the given role can access — Administrator bypasses the table
 * entirely. Used both by AppShell (nav filtering) and each page's server
 * component (actual enforcement, not just hiding the link). */
export async function getAccessibleModules(role: AppUserRow['role']): Promise<Set<PortalModule>> {
  if (role === 'Administrator') {
    return new Set(['dashboard', 'capture', 'invoices', 'workflows', 'reports', 'audit', 'notifications', 'admin']);
  }
  const { data, error } = await createServiceClient().from('role_permissions').select('module, can_access').eq('role', role)
    .overrideTypes<Pick<RolePermissionRow, 'module' | 'can_access'>[], { merge: false }>();
  if (error) throw error;
  return new Set(data.filter(r => r.can_access).map(r => r.module));
}

/** Call at the top of a protected page's server component — redirects to
 * /dashboard if the signed-in user's role lacks this module, so permissions
 * are enforced server-side and not just by hiding the nav link. */
export async function requireModuleAccess(module: PortalModule): Promise<void> {
  const user = await getCurrentAppUser();
  if (user.role === 'Administrator') return;
  const modules = await getAccessibleModules(user.role);
  if (!modules.has(module)) redirect('/dashboard');
}
