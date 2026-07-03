'use server';

import { createServiceClient } from '@/lib/supabase/service';
import type { AppSettingsRow } from '@/lib/supabase/types';

/** SOW §12 — the Stock/Non-Stock amount-check threshold (default €500) is
 * configurable in the system rather than hardcoded. Read by the workflow
 * branch-routing logic in advanceWorkflowTask(). */
export async function getApprovalThreshold(): Promise<number> {
  // .overrideTypes(...) bypasses postgrest-js's select-string type parser,
  // which resolves to `never` under the project's TypeScript 6 — see the
  // same workaround in users.ts.
  const { data, error } = await createServiceClient().from('app_settings').select('approval_threshold').eq('id', true).single()
    .overrideTypes<Pick<AppSettingsRow, 'approval_threshold'>, { merge: false }>();
  if (error) throw error;
  return data.approval_threshold;
}

export async function updateApprovalThreshold(value: number): Promise<void> {
  const row = { approval_threshold: value };
  const { error } = await createServiceClient().from('app_settings').update(row as never).eq('id', true);
  if (error) throw error;
}
