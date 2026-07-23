'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { getCurrentAppUser } from '@/lib/server/users';
import { genCode } from '@/lib/server/codes';
import type { AuditEventRow, AuditChange } from '@/lib/supabase/types';

/** Best-effort source IP from standard proxy headers — there's no direct
 * socket access from a Server Action, so this is only as reliable as
 * whatever's in front of the app (e.g. Vercel/a reverse proxy) setting
 * x-forwarded-for correctly. Falls back to null rather than throwing. */
async function requestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip');
}

export interface RecordAuditEventInput {
  action: string;
  module: AuditEventRow['module'];
  target?: string | null;
  icon?: string;
  tone?: string;
  invoiceId?: string | null;
  changes?: AuditChange[];
}

/** Append-only — this module never updates or deletes an audit_events row.
 * Called from every mutating action in invoices.ts, workflows.ts, users.ts,
 * and CaptureView's store flow, per SOW §5.7 (immutable action log). */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  const supabase = createServiceClient();
  const user = await getCurrentAppUser();

  const row = {
    code: genCode('EVT'),
    actor_id: user.id === 'guest' ? null : user.id,
    actor_name: user.name,
    actor_role: user.role,
    action: input.action,
    icon: input.icon ?? null,
    tone: input.tone ?? null,
    target: input.target ?? null,
    module: input.module,
    ip: await requestIp(),
    invoice_id: input.invoiceId ?? null,
    changes: input.changes ?? null,
  };
  // `as never` bypasses postgrest-js's insert-argument type resolution,
  // which breaks down to `never` under the project's TypeScript 6 — see
  // the .overrideTypes(...) workaround used for reads in this codebase.
  const { error } = await supabase.from('invoice_audit_events').insert(row as never);
  if (error) throw error;
}

export interface AuditEventFilters {
  invoiceId?: string;
  module?: AuditEventRow['module'];
  limit?: number;
}

/** Backs AuditView (global log) and the per-invoice History panel on
 * InvoicesView (SOW §5.7 — immutable per-invoice action log, T149). */
export async function getAuditEvents(filters: AuditEventFilters = {}): Promise<AuditEventRow[]> {
  const supabase = createServiceClient();
  let query = supabase.from('invoice_audit_events').select('*').order('occurred_at', { ascending: false });
  if (filters.invoiceId) query = query.eq('invoice_id', filters.invoiceId);
  if (filters.module) query = query.eq('module', filters.module);
  if (filters.limit) query = query.limit(filters.limit);

  // .overrideTypes(...) bypasses postgrest-js's select-string type parser,
  // which resolves to `never` under the project's TypeScript 6.
  const { data, error } = await query.overrideTypes<AuditEventRow[], { merge: false }>();
  if (error) throw error;
  return data;
}
