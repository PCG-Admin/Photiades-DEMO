'use server';

import { createServiceClient } from '@/lib/supabase/service';
import type { AppUserRow, ApproverMappingRow } from '@/lib/supabase/types';

export type NewApproverMapping = Omit<ApproverMappingRow, 'id' | 'created_at'>;

export async function listApproverMappings(): Promise<ApproverMappingRow[]> {
  const { data, error } = await createServiceClient().from('invoice_approver_mappings').select('*').order('task_id').order('min_amount')
    .overrideTypes<ApproverMappingRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function createApproverMapping(mapping: NewApproverMapping): Promise<ApproverMappingRow> {
  const { data, error } = await createServiceClient().from('invoice_approver_mappings').insert(mapping as never).select('*').single()
    .overrideTypes<ApproverMappingRow, { merge: false }>();
  if (error) throw error;
  return data;
}

export async function deleteApproverMapping(id: string): Promise<void> {
  const { error } = await createServiceClient().from('invoice_approver_mappings').delete().eq('id', id);
  if (error) throw error;
}

/** Looks up the configured approver for a task at a given invoice amount —
 * the row with the tightest matching [min_amount, max_amount] range wins so
 * a specific bracket (e.g. €500-€5000) takes priority over a catch-all
 * (both bounds null). Returns null when no mapping is configured for the
 * task, so callers fall back to the task's fixed WFTask.role. */
export async function resolveApproverForTask(taskId: string, amount: number): Promise<{ role: AppUserRow['role']; userId: string | null } | null> {
  const rows = await listApproverMappings();
  const matches = rows.filter(r => r.task_id === taskId
    && (r.min_amount == null || amount >= r.min_amount)
    && (r.max_amount == null || amount <= r.max_amount));
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const widthOf = (r: ApproverMappingRow) => (r.max_amount ?? Infinity) - (r.min_amount ?? -Infinity);
    return widthOf(a) - widthOf(b);
  });
  const best = matches[0];
  return { role: best.approver_role, userId: best.approver_user_id };
}
