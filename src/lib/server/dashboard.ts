'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { wfById } from '@/lib/workflow';
import type { InvoiceRow, WorkflowInstanceRow } from '@/lib/supabase/types';

export interface ChartDatum { label: string; value: number; color?: string }
export interface PipelineStage { stage: string; count: number; color: string }

export interface DashboardData {
  totalInvoices: number;
  inProgressWorkflows: number;
  exceptions: number;
  totalOutstandingValue: number;
  statusMix: ChartDatum[];
  stockMix: ChartDatum[];
  workflowTasks: PipelineStage[];
}

const STATUS_COLORS: Record<string, string> = {
  'Approved': 'oklch(0.58 0.12 150)', 'Paid': 'oklch(0.58 0.12 150)', 'Paid Invoice': 'oklch(0.58 0.12 150)',
  'In Review': 'oklch(0.72 0.13 75)', 'Awaiting Approval': 'oklch(0.48 0.13 255)',
  'Exception': 'oklch(0.58 0.16 25)', 'Declined': 'oklch(0.58 0.16 25)',
};

// Fixed categorical order — never cycled/reassigned as the mix of stock
// types present changes, so a given label always draws the same hue.
const STOCK_COLORS: Record<string, string> = {
  'Stock': 'var(--accent)', 'Non-stock': 'var(--teal)', 'Stock & Non Stock': 'var(--violet)', 'Unclassified': 'var(--muted)',
};

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createServiceClient();

  const { data: invoices, error: invErr } = await supabase.from('invoices').select('*')
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (invErr) throw invErr;

  const { data: instances, error: instErr } = await supabase.from('invoice_workflow_instances').select('*')
    .overrideTypes<WorkflowInstanceRow[], { merge: false }>();
  if (instErr) throw instErr;

  const statusCounts = new Map<string, number>();
  const stockCounts = new Map<string, number>();
  let exceptions = 0;
  let totalOutstandingValue = 0;
  for (const inv of invoices) {
    statusCounts.set(inv.status, (statusCounts.get(inv.status) ?? 0) + 1);
    const stockLabel = inv.stock_type ?? 'Unclassified';
    stockCounts.set(stockLabel, (stockCounts.get(stockLabel) ?? 0) + 1);
    if (inv.flags.length > 0) exceptions += 1;
    if (!['Paid', 'Paid Invoice'].includes(inv.status)) totalOutstandingValue += inv.total;
  }

  const taskCounts = new Map<string, number>();
  let inProgress = 0;
  for (const inst of instances) {
    if (inst.status === 'In Progress' || inst.status === 'Info Requested') inProgress += 1;
    if (inst.status !== 'In Progress') continue;
    const taskName = wfById(inst.wf_id).tasks[inst.task_idx]?.name ?? `Task ${inst.task_idx + 1}`;
    taskCounts.set(taskName, (taskCounts.get(taskName) ?? 0) + 1);
  }

  return {
    totalInvoices: invoices.length,
    inProgressWorkflows: inProgress,
    exceptions,
    totalOutstandingValue,
    statusMix: Array.from(statusCounts.entries()).map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? 'var(--muted)' })),
    stockMix: Array.from(stockCounts.entries()).map(([label, value]) => ({ label, value, color: STOCK_COLORS[label] ?? 'var(--muted)' })),
    workflowTasks: Array.from(taskCounts.entries()).map(([stage, count]) => ({ stage, count, color: 'var(--accent)' })),
  };
}
