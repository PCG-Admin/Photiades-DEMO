'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAppUser } from '@/lib/server/users';
import type { NotificationRow, AppUserRow } from '@/lib/supabase/types';

/** Backs NotificationsView and the AppShell bell badge. There is no login
 * flow right now, so the GUEST_USER identity (see users.ts) has no real
 * app_users row to scope "your" notifications to — it sees every
 * notification in the system instead, same relaxation as Administrator
 * seeing every approval task. */
export async function getNotificationsForCurrentUser(): Promise<NotificationRow[]> {
  const user = await getCurrentAppUser();
  let query = createServiceClient().from('notifications').select('*').order('created_at', { ascending: false });
  if (user.id !== 'guest') query = query.eq('user_id', user.id);
  const { data, error } = await query.overrideTypes<NotificationRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const row = { read: true };
  const { error } = await createServiceClient().from('notifications').update(row as never).eq('id', id);
  if (error) throw error;
}

/** Fans a system notification out to every app_users row with the given
 * role. Called from workflows.ts's advanceWorkflowTask() whenever a task's
 * assignee_role changes. */
export async function notifyRole(role: string, notification: Omit<NotificationRow, 'id' | 'user_id' | 'created_at' | 'read'>): Promise<void> {
  const supabase = createServiceClient();
  const { data: users, error } = await supabase.from('app_users').select('*').eq('role', role)
    .overrideTypes<AppUserRow[], { merge: false }>();
  if (error) throw error;
  if (users.length === 0) return;

  const rows = users.map(u => ({ ...notification, user_id: u.id, read: false }));
  const { error: insertError } = await supabase.from('notifications').insert(rows as never);
  if (insertError) throw insertError;
}
