'use server';

/* SOW §5.6 Reporting Module. Each report fetches the relevant raw rows and
 * aggregates in TypeScript rather than complex SQL, per the "keep query
 * complexity minimal" decision — reasonable at the data volumes a testing
 * deployment produces; revisit with real SQL aggregates if volume grows. */

import { createServiceClient } from '@/lib/supabase/service';
import type { InvoiceRow, WorkflowHistoryRow } from '@/lib/supabase/types';

const DAY_MS = 86_400_000;

// ---------- T143: Invoice Aging ----------
export interface AgingBucket { label: string; count: number; total: number }

export async function getInvoiceAging(): Promise<AgingBucket[]> {
  const { data: invoices, error } = await createServiceClient()
    .from('invoices').select('*').not('status', 'in', '("Paid","Paid Invoice")')
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;

  const buckets: (AgingBucket & { min: number; max: number })[] = [
    { label: 'Not yet due', min: -Infinity, max: -1, count: 0, total: 0 },
    { label: '0-30 days overdue', min: 0, max: 30, count: 0, total: 0 },
    { label: '31-60 days overdue', min: 31, max: 60, count: 0, total: 0 },
    { label: '61-90 days overdue', min: 61, max: 90, count: 0, total: 0 },
    { label: '90+ days overdue', min: 91, max: Infinity, count: 0, total: 0 },
  ];
  const now = Date.now();
  for (const inv of invoices) {
    const days = Math.floor((now - new Date(inv.due_at).getTime()) / DAY_MS);
    const bucket = buckets.find(b => days >= b.min && days <= b.max) ?? buckets[buckets.length - 1];
    bucket.count += 1;
    bucket.total += inv.total;
  }
  return buckets.map(({ label, count, total }) => ({ label, count, total }));
}

// ---------- T144: Approval SLA (time spent at each workflow task) ----------
export interface SlaRow { taskName: string; avgHours: number; count: number }

export async function getApprovalSLA(since?: string | null): Promise<SlaRow[]> {
  let query = createServiceClient().from('invoice_workflow_history').select('*').order('instance_id').order('occurred_at');
  if (since) query = query.gte('occurred_at', since);
  const { data: history, error } = await query.overrideTypes<WorkflowHistoryRow[], { merge: false }>();
  if (error) throw error;

  const durationsByTask = new Map<string, number[]>();
  let currentInstance: string | null = null;
  let prev: WorkflowHistoryRow | null = null;
  for (const row of history) {
    if (row.instance_id !== currentInstance) { currentInstance = row.instance_id; prev = null; }
    if (prev) {
      const hours = (new Date(row.occurred_at).getTime() - new Date(prev.occurred_at).getTime()) / 3_600_000;
      const list = durationsByTask.get(prev.task_name) ?? [];
      list.push(hours);
      durationsByTask.set(prev.task_name, list);
    }
    prev = row;
  }

  // 1. Map to display names first
  const mappedRows = Array.from(durationsByTask.entries())
    .map(([taskName, hours]) => {
      let displayName = taskName;
      if (taskName === 'AcDep-Check') displayName = 'Accounts Department Check';
      if (taskName === 'AcMgr-Approval') displayName = 'Accounts Manager Check';

      return { 
        taskName: displayName, 
        avgHours: hours.reduce((a, b) => a + b, 0) / hours.length, 
        count: hours.length 
      };
    });

  // 2. Aggregate duplicates by taskName (Fix the duplicate keys error)
  const aggregatedMap = new Map<string, { totalHours: number; totalCount: number }>();
  for (const row of mappedRows) {
    const existing = aggregatedMap.get(row.taskName);
    if (existing) {
      // Weighted average: (avg1 * count1 + avg2 * count2) / (count1 + count2)
      const combinedAvg = ((existing.totalHours * existing.totalCount) + (row.avgHours * row.count)) / (existing.totalCount + row.count);
      aggregatedMap.set(row.taskName, { 
        totalHours: combinedAvg, 
        totalCount: existing.totalCount + row.count 
      });
    } else {
      aggregatedMap.set(row.taskName, { 
        totalHours: row.avgHours, 
        totalCount: row.count 
      });
    }
  }

  // 3. Convert back to array and sort
  return Array.from(aggregatedMap.entries())
    .map(([taskName, data]) => ({ 
      taskName, 
      avgHours: data.totalHours, 
      count: data.totalCount 
    }))
    .sort((a, b) => b.avgHours - a.avgHours);
}

// ---------- T145: Approver Performance (volume / turnaround per approver) ----------
export interface ApproverPerformanceRow { actorName: string; actions: number; avgTurnaroundHours: number | null }

export async function getApproverPerformance(since?: string | null): Promise<ApproverPerformanceRow[]> {
  let query = createServiceClient().from('invoice_workflow_history').select('*').order('instance_id').order('occurred_at');
  if (since) query = query.gte('occurred_at', since);
  const { data: history, error } = await query.overrideTypes<WorkflowHistoryRow[], { merge: false }>();
  if (error) throw error;

  const byActor = new Map<string, { actions: number; turnarounds: number[] }>();
  let currentInstance: string | null = null;
  let prevAt: number | null = null;
  for (const row of history) {
    if (row.instance_id !== currentInstance) { currentInstance = row.instance_id; prevAt = null; }
    const entry = byActor.get(row.actor_name) ?? { actions: 0, turnarounds: [] };
    entry.actions += 1;
    if (prevAt != null) entry.turnarounds.push((new Date(row.occurred_at).getTime() - prevAt) / 3_600_000);
    byActor.set(row.actor_name, entry);
    prevAt = new Date(row.occurred_at).getTime();
  }

  return Array.from(byActor.entries())
    .map(([actorName, { actions, turnarounds }]) => ({
      actorName, actions,
      avgTurnaroundHours: turnarounds.length > 0 ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : null,
    }))
    .sort((a, b) => b.actions - a.actions);
}

// ---------- T146: Declined Invoices trend ----------
export interface DeclinedRow { code: string; vendor: string; amount: number; taskName: string; reason: string; when: string }

export async function getDeclinedTrend(since?: string | null): Promise<DeclinedRow[]> {
  const supabase = createServiceClient();
  let query = supabase.from('invoice_workflow_history').select('*').eq('action_key', 'declined').order('occurred_at', { ascending: false });
  if (since) query = query.gte('occurred_at', since);
  const { data: history, error } = await query.overrideTypes<WorkflowHistoryRow[], { merge: false }>();
  if (error) throw error;
  if (history.length === 0) return [];

  const { data: instances } = await supabase
    .from('invoice_workflow_instances').select('*').in('id', history.map(h => h.instance_id))
    .overrideTypes<{ id: string; invoice_id: string }[], { merge: false }>();
  const { data: invoices } = await supabase
    .from('invoices').select('*').in('id', (instances ?? []).map(i => i.invoice_id))
    .overrideTypes<InvoiceRow[], { merge: false }>();

  return history.map(h => {
    const instance = instances?.find(i => i.id === h.instance_id);
    const invoice = invoices?.find(inv => inv.id === instance?.invoice_id);
    const fields = typeof h.fields === 'object' && h.fields !== null ? h.fields as Record<string, unknown> : {};
    
    let displayName = h.task_name;
    if (displayName === 'AcDep-Check') displayName = 'Accounts Department Check';
    if (displayName === 'AcMgr-Approval') displayName = 'Accounts Manager Check';

    return {
      code: invoice?.code ?? '—', 
      vendor: invoice?.vendor ?? '—', 
      amount: invoice?.total ?? 0,
      taskName: displayName,
      reason: typeof fields.com === 'string' ? fields.com : '', 
      when: h.occurred_at,
    };
  });
}

// ---------- T147: Pending Payments ----------
export async function getPendingPayments(): Promise<InvoiceRow[]> {
  const { data, error } = await createServiceClient()
    .from('invoices').select('*').eq('status', 'Pending Payment').order('due_at')
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

// ---------- T148: Custom filter export ----------
export interface InvoiceExportFilters { status?: string; vendor?: string; stockType?: string }

export async function exportInvoices(filters: InvoiceExportFilters): Promise<InvoiceRow[]> {
  let query = createServiceClient().from('invoices').select('*').order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.vendor) query = query.ilike('vendor', `%${filters.vendor}%`);
  if (filters.stockType) query = query.eq('stock_type', filters.stockType);
  const { data, error } = await query.overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;
  return data;
}