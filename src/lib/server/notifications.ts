'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAppUser } from '@/lib/server/users';
import type { NotificationRow, AppUserRow } from '@/lib/supabase/types';

/** Backs NotificationsView and the AppShell bell badge. Administrators see
 * every notification in the system — same full-oversight bypass used by
 * getApprovalsInbox/getAccessibleModules — since notifyRole() only ever
 * targets the specific role a task is assigned to (never 'Administrator'
 * itself), so without this bypass an Administrator account would never
 * receive a single notification. The GUEST_USER fallback (no real app_users
 * row — see users.ts) sees none, matching its least-privileged Viewer role. */
export async function getNotificationsForCurrentUser(): Promise<NotificationRow[]> {
  const user = await getCurrentAppUser();
  if (user.id === 'guest') return [];
  let query = createServiceClient().from('invoice_notifications').select('*').order('created_at', { ascending: false });
  if (user.role !== 'Administrator') query = query.eq('user_id', user.id);
  const { data, error } = await query.overrideTypes<NotificationRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const row = { read: true };
  const { error } = await createServiceClient().from('invoice_notifications').update(row as never).eq('id', id);
  if (error) throw error;
}

export interface NotificationTarget { view: 'invoices' | 'workflows'; code: string }

/** Notifications store ref_invoice_id/ref_instance_id as raw UUIDs, but
 * InvoicesView/WorkflowsView both select by human-readable `code` — this
 * resolves the UUID to the code so clicking a notification can actually
 * navigate somewhere instead of just marking it read. */
export async function resolveNotificationTarget(n: Pick<NotificationRow, 'ref_invoice_id' | 'ref_instance_id'>): Promise<NotificationTarget | null> {
  const supabase = createServiceClient();
  if (n.ref_instance_id) {
    const { data } = await supabase.from('invoice_workflow_instances').select('code').eq('id', n.ref_instance_id).single();
    if (data) return { view: 'workflows', code: (data as { code: string }).code };
  }
  if (n.ref_invoice_id) {
    const { data } = await supabase.from('invoices').select('code').eq('id', n.ref_invoice_id).single();
    if (data) return { view: 'invoices', code: (data as { code: string }).code };
  }
  return null;
}

/** Fans a system notification out to every app_users row with the given
 * role. Called from workflows.ts's advanceWorkflowTask() whenever a task's
 * assignee_role changes. */
export async function notifyRole(role: string, notification: Omit<NotificationRow, 'id' | 'user_id' | 'created_at' | 'read'>): Promise<void> {
  const supabase = createServiceClient();
  const { data: users, error } = await supabase.from('invoice_app_users').select('*').eq('role', role)
    .overrideTypes<AppUserRow[], { merge: false }>();
  if (error) throw error;
  if (users.length === 0) return;

  const rows = users.map(u => ({ ...notification, user_id: u.id, read: false }));
  const { error: insertError } = await supabase.from('invoice_notifications').insert(rows as never);
  if (insertError) throw insertError;
}
