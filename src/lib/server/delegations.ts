'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAppUser } from '@/lib/server/users';
import { recordAuditEvent } from '@/lib/server/audit';
import type { DelegationRow } from '@/lib/supabase/types';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The signed-in user's current out-of-office delegation, if any (past ones
 * are left in the table as history, so this only returns one still covering
 * today or the future). */
export async function getMyDelegation(): Promise<DelegationRow | null> {
  const user = await getCurrentAppUser();
  const { data, error } = await createServiceClient().from('invoice_delegations').select('*')
    .eq('user_id', user.id).gte('end_date', today()).order('start_date', { ascending: false }).limit(1).maybeSingle()
    .overrideTypes<DelegationRow | null, { merge: false }>();
  if (error) throw error;
  return data;
}

/** One active delegation per user at a time — replaces any existing row for
 * simplicity rather than modeling overlapping ranges. */
export async function setMyDelegation(backupUserId: string, startDate: string, endDate: string, note: string | null): Promise<DelegationRow> {
  const user = await getCurrentAppUser();
  const supabase = createServiceClient();
  await supabase.from('invoice_delegations').delete().eq('user_id', user.id);
  const { data, error } = await supabase.from('invoice_delegations')
    .insert({ user_id: user.id, backup_user_id: backupUserId, start_date: startDate, end_date: endDate, note } as never)
    .select('*').single()
    .overrideTypes<DelegationRow, { merge: false }>();
  if (error) throw error;
  await recordAuditEvent({
    action: 'Set backup approver', module: 'Admin', target: user.name,
    changes: [{ field: 'delegation', before: null, after: `${data.backup_user_id} (${startDate} – ${endDate})` }],
  });
  return data;
}

export async function clearMyDelegation(): Promise<void> {
  const user = await getCurrentAppUser();
  const { error } = await createServiceClient().from('invoice_delegations').delete().eq('user_id', user.id);
  if (error) throw error;
  await recordAuditEvent({ action: 'Cleared backup approver', module: 'Admin', target: user.name });
}

/** User ids that have an active-today delegation naming `userId` as their
 * backup — used by getApprovalsInbox() so tasks pinned to a specific
 * assignee_id surface in the backup's inbox while the primary is out. */
export async function getUsersWhoDelegatedToMe(userId: string): Promise<string[]> {
  const { data, error } = await createServiceClient().from('invoice_delegations').select('user_id')
    .eq('backup_user_id', userId).lte('start_date', today()).gte('end_date', today())
    .overrideTypes<Pick<DelegationRow, 'user_id'>[], { merge: false }>();
  if (error) throw error;
  return data.map(d => d.user_id);
}
