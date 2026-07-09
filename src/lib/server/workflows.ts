'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { genCode } from '@/lib/server/codes';
import { wfById } from '@/lib/workflow';
import { getCurrentAppUser, findAppUserByName } from '@/lib/server/users';
import { getApprovalThreshold } from '@/lib/server/settings';
import { resolveApproverForTask } from '@/lib/server/approverMappings';
import { getUsersWhoDelegatedToMe } from '@/lib/server/delegations';
import { recordAuditEvent } from '@/lib/server/audit';
import { notifyRole } from '@/lib/server/notifications';
import type { WorkflowInstanceRow, WorkflowHistoryRow, InvoiceRow } from '@/lib/supabase/types';

export interface WorkflowInstanceWithHistory extends WorkflowInstanceRow {
  history: WorkflowHistoryRow[];
}

/** Resolves who a task should be assigned to: a configured approver_mappings
 * row for this task+amount takes priority (T169 — admin-configurable
 * routing), falling back to the task's fixed WFTask.role when no mapping
 * matches, so workflows keep working unmodified until an admin adds one. */
async function resolveAssignee(taskId: string, amount: number, fallbackRole: string): Promise<{ assignee_role: string; assignee_id: string | null }> {
  const mapping = await resolveApproverForTask(taskId, amount);
  return mapping ? { assignee_role: mapping.role, assignee_id: mapping.userId } : { assignee_role: fallbackRole, assignee_id: null };
}

/** Starts the Stock or Non-Stock workflow for a newly captured invoice, at
 * its first task. Called by invoices.ts's createInvoiceFromExtraction(). */
export async function createWorkflowInstance(invoiceId: string, wfId: WorkflowInstanceRow['wf_id'], amount: number): Promise<WorkflowInstanceRow> {
  const firstTask = wfById(wfId).tasks[0];
  const assignee = await resolveAssignee(firstTask.id, amount, firstTask.role);
  const row = {
    code: genCode('WF'),
    wf_id: wfId,
    invoice_id: invoiceId,
    task_idx: 0,
    status: 'In Progress' as const,
    ...assignee,
  };
  // `as never` bypasses postgrest-js's insert-argument type resolution,
  // which breaks down to `never` under the project's TypeScript 6.
  const { data, error } = await createServiceClient()
    .from('workflow_instances')
    .insert(row as never)
    .select('*')
    .single()
    .overrideTypes<WorkflowInstanceRow, { merge: false }>();
  if (error) throw error;
  return data;
}

/** Approvals-inbox row shape — the Approvals view stays derived from
 * workflow_instances + the in-code WFTask role for the instance's current
 * task, never from a separate table (see plan decision #4). */
export interface ApprovalInboxItem {
  instance: WorkflowInstanceRow;
  invoiceCode: string;
  vendor: string;
  amount: number;
  currentTaskName: string;
}

export async function getWorkflowInstances(): Promise<WorkflowInstanceRow[]> {
  const { data, error } = await createServiceClient()
    .from('workflow_instances').select('*').order('started_at', { ascending: false })
    .overrideTypes<WorkflowInstanceRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export interface WorkflowInstanceListItem {
  instance: WorkflowInstanceRow;
  invoiceCode: string;
  vendor: string;
  po: string | null;
  amount: number;
}

/** Backs WorkflowsView's in-flight list — each instance joined with its
 * invoice's display fields (vendor/PO/amount aren't stored on the instance
 * itself). */
export async function getWorkflowInstancesWithInvoices(): Promise<WorkflowInstanceListItem[]> {
  const instances = await getWorkflowInstances();
  if (instances.length === 0) return [];

  const { data: invoices, error } = await createServiceClient()
    .from('invoices').select('*').in('id', instances.map(i => i.invoice_id))
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;

  return instances.map(instance => {
    const invoice = invoices.find(inv => inv.id === instance.invoice_id);
    return { instance, invoiceCode: invoice?.code ?? '—', vendor: invoice?.vendor ?? '—', po: invoice?.po ?? null, amount: invoice?.total ?? 0 };
  });
}

async function withHistory(instance: WorkflowInstanceRow): Promise<WorkflowInstanceWithHistory> {
  const { data: history, error } = await createServiceClient()
    .from('workflow_history').select('*').eq('instance_id', instance.id).order('occurred_at')
    .overrideTypes<WorkflowHistoryRow[], { merge: false }>();
  if (error) throw error;
  return { ...instance, history };
}

export async function getWorkflowInstance(code: string): Promise<WorkflowInstanceWithHistory | null> {
  const { data: instance, error } = await createServiceClient()
    .from('workflow_instances').select('*').eq('code', code).single()
    .overrideTypes<WorkflowInstanceRow, { merge: false }>();
  if (error) return null;
  return withHistory(instance);
}

export interface WorkflowInstanceDetail extends WorkflowInstanceWithHistory {
  invoiceCode: string;
  vendor: string;
  po: string | null;
  amount: number;
}

/** Backs the WorkflowRunner detail screen — instance + history + the
 * linked invoice's display fields. */
export async function getWorkflowInstanceDetail(code: string): Promise<WorkflowInstanceDetail | null> {
  const withHist = await getWorkflowInstance(code);
  if (!withHist) return null;
  const { data: invoice } = await createServiceClient()
    .from('invoices').select('*').eq('id', withHist.invoice_id).single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  return { ...withHist, invoiceCode: invoice?.code ?? '—', vendor: invoice?.vendor ?? '—', po: invoice?.po ?? null, amount: invoice?.total ?? 0 };
}

/** Used by InvoicesView's approval-chain panel — an invoice has at most one
 * active workflow per wf_id (schema's unique(invoice_id, wf_id)), and in
 * practice exactly one is created per invoice at capture time. */
export async function getWorkflowInstanceForInvoice(invoiceId: string): Promise<WorkflowInstanceWithHistory | null> {
  const { data: instance, error } = await createServiceClient()
    .from('workflow_instances').select('*').eq('invoice_id', invoiceId).limit(1).maybeSingle()
    .overrideTypes<WorkflowInstanceRow | null, { merge: false }>();
  if (error || !instance) return null;
  return withHistory(instance);
}

async function insertHistoryRow(instanceId: string, taskId: string, taskName: string, actionKey: string, actionLabel: string, actorId: string | null, actorName: string, fields: Record<string, string | number>) {
  const row = {
    instance_id: instanceId, task_id: taskId, task_name: taskName,
    action_key: actionKey, action_label: actionLabel,
    actor_id: actorId, actor_name: actorName, fields,
  };
  const { error } = await createServiceClient().from('workflow_history').insert(row as never);
  if (error) throw error;
}

/** Server Action backing WorkflowsView's task-decision UI. `actionKey` is
 * normally one of the fixed WFAction keys for the instance's current task
 * (approved/declined/requestInfo/...), plus three synthetic keys the client
 * sends for steps that aren't a plain WFAction pick:
 * - 'routeAmountCheck' — confirms the auto/branch "Amount check" task,
 *   reading getApprovalThreshold() instead of the hardcoded WFBranch.threshold.
 * - 'additionalGrant' / 'additionalDecline' — resolves a pending
 *   "Additional Approval" routing (WFAction key 'additional' pauses the
 *   instance at the same task, awaiting this follow-up call). */
export async function advanceWorkflowTask(instanceId: string, actionKey: string, fields: Record<string, string | number>): Promise<WorkflowInstanceWithHistory> {
  const supabase = createServiceClient();
  const currentUser = await getCurrentAppUser();
  const actorId = currentUser.id === 'guest' ? null : currentUser.id;

  const { data: instance, error: instErr } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single()
    .overrideTypes<WorkflowInstanceRow, { merge: false }>();
  if (instErr) throw instErr;

  const { data: invoice, error: invErr } = await supabase.from('invoices').select('*').eq('id', instance.invoice_id).single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (invErr) throw invErr;

  const tasks = wfById(instance.wf_id).tasks;
  const task = tasks[instance.task_idx];

  let instancePatch: Partial<WorkflowInstanceRow> = {};
  let invoicePatch: Partial<InvoiceRow> = {};
  let auditAction = `${task.name} → ${actionKey}`;

  if (actionKey === 'routeAmountCheck') {
    const threshold = await getApprovalThreshold();
    const branch = task.branch;
    if (!branch) throw new Error(`Task "${task.name}" has no amount-check branch.`);
    const over = invoice.total > threshold;
    const destIdx = over ? branch.overIdx : branch.underIdx;
    instancePatch = { task_idx: destIdx, ...(await resolveAssignee(tasks[destIdx].id, invoice.total, tasks[destIdx].role)) };
    auditAction = `Amount check — routed to ${tasks[destIdx].name}`;
    await insertHistoryRow(instanceId, task.id, task.name, actionKey, `Routed to ${tasks[destIdx].name}`, null, 'System', fields);
  } else if (actionKey === 'additionalGrant' || actionKey === 'additionalDecline') {
    const grant = actionKey === 'additionalGrant';
    await insertHistoryRow(instanceId, task.id, task.name, actionKey, grant ? 'Additional approval granted' : 'Additional approval declined', actorId, currentUser.name, fields);
    if (!grant) {
      instancePatch = { status: 'Declined', assignee_id: null };
      invoicePatch = { status: 'Declined' };
    } else {
      const nextIdx = instance.task_idx + 1;
      instancePatch = nextIdx >= tasks.length
        ? { status: 'Completed', assignee_id: null }
        : { task_idx: nextIdx, status: 'In Progress', ...(await resolveAssignee(tasks[nextIdx].id, invoice.total, tasks[nextIdx].role)) };
      if (nextIdx >= tasks.length) invoicePatch = { status: 'Approved' };
    }
    auditAction = grant ? 'Additional approval granted' : 'Additional approval declined';
  } else {
    const action = task.actions?.find(a => a.key === actionKey);
    if (!action) throw new Error(`Unknown action "${actionKey}" for task "${task.name}".`);
    const missing = action.fields.find(f => f.required && !String(fields[f.k] ?? '').trim());
    if (missing) throw new Error(`${missing.label} is required.`);

    await insertHistoryRow(instanceId, task.id, task.name, action.key, action.label, actorId, currentUser.name, fields);
    auditAction = `${task.name} → ${action.label}`;

    // Task 1 ("... Inv Imported") "Approved" outcome lets the AP Clerk
    // correct the invoice's core fields before routing onward.
    if (instance.task_idx === 0 && action.key === 'approved') {
      if (fields.invNo) invoicePatch.invoice_no = String(fields.invNo);
      if (fields.po !== undefined) invoicePatch.po = fields.po ? String(fields.po) : null;
      if (fields.amount) invoicePatch.total = Number(fields.amount) || invoice.total;
    }

    switch (action.key) {
      case 'declined':
        instancePatch = { status: 'Declined' };
        invoicePatch.status = 'Declined';
        break;
      case 'notPlaced':
        instancePatch = { status: 'Order not placed via PD' };
        invoicePatch.status = 'Order not placed via PD';
        break;
      case 'pendPmt':
        instancePatch = { status: 'Pending Payment' };
        invoicePatch.status = 'Pending Payment';
        if (fields.stkDoc) invoicePatch.stock_doc_number = String(fields.stkDoc);
        if (fields.nonStkDoc) invoicePatch.non_stock_doc_number = String(fields.nonStkDoc);
        break;
      case 'requestInfo':
        // Stays parked at the current task — no reassignment, no restart of
        // the approval chain. AP Clerk gets a separate notification (below,
        // after the general assignee-notify block) pointing at the invoice,
        // since fixing missing/wrong data happens on the invoice itself, not
        // by acting on this workflow task.
        instancePatch = { status: 'Info Requested' };
        break;
      case 'additional': {
        const approver = await findAppUserByName(String(fields.approver || ''));
        instancePatch = { assignee_id: approver?.id ?? null };
        break;
      }
      default: {
        // forward transitions: approved / reviewed
        const amount = invoicePatch.total ?? invoice.total;
        const nextIdx = instance.task_idx + 1;
        if (nextIdx >= tasks.length) {
          instancePatch = { status: 'Completed' };
          invoicePatch.status = 'Approved';
        } else {
          instancePatch = { task_idx: nextIdx, status: 'In Progress', ...(await resolveAssignee(tasks[nextIdx].id, amount, tasks[nextIdx].role)) };
        }
      }
    }
  }

  const { error: updErr } = await supabase.from('workflow_instances').update(instancePatch as never).eq('id', instanceId);
  if (updErr) throw updErr;

  if (Object.keys(invoicePatch).length > 0) {
    const { error: invUpdErr } = await supabase.from('invoices').update(invoicePatch as never).eq('id', invoice.id);
    if (invUpdErr) throw invUpdErr;
  }

  await recordAuditEvent({ action: auditAction, module: 'Workflows', target: invoice.code, invoiceId: invoice.id, icon: 'zap', tone: 'blue' });

  if (instancePatch.assignee_role && instancePatch.status !== 'Completed') {
    await notifyRole(instancePatch.assignee_role, {
      kind: 'task', title: `${tasks[instancePatch.task_idx ?? instance.task_idx].name} awaiting action`,
      detail: `${invoice.vendor} — ${invoice.code}`, icon: 'zap', tone: 'blue',
      ref_invoice_id: invoice.id, ref_instance_id: instanceId,
    });
  }

  if (actionKey === 'requestInfo') {
    // Points at the invoice, not the workflow task — AP Clerk's job here is
    // fixing/adding data on the invoice itself, not acting on this task.
    await notifyRole('AP Clerk', {
      kind: 'declined', title: `More info needed on ${invoice.code}`,
      detail: `${task.name} requested: ${String(fields.com ?? '').slice(0, 120) || 'see comment on the task'}`,
      icon: 'alert', tone: 'amber',
      ref_invoice_id: invoice.id, ref_instance_id: null,
    });
  }

  const { data: updatedInstance, error: reErr } = await supabase.from('workflow_instances').select('*').eq('id', instanceId).single()
    .overrideTypes<WorkflowInstanceRow, { merge: false }>();
  if (reErr) throw reErr;
  return withHistory(updatedInstance);
}

/** Approvals inbox (SOW's Approvals view, decision #4) — derived from
 * workflow_instances whose current task's role matches the caller's role;
 * never a separate table. */
export async function getApprovalsInbox(userRole: string, userId: string): Promise<ApprovalInboxItem[]> {
  // 'Info Requested' stays in the assignee's inbox too — requestInfo no
  // longer reassigns the task, it just flags it while AP Clerk fixes the
  // invoice, so the original approver still needs to see (and can still
  // act on) it once that's done.
  const { data: instances, error } = await createServiceClient()
    .from('workflow_instances').select('*').in('status', ['In Progress', 'Info Requested']).order('started_at')
    .overrideTypes<WorkflowInstanceRow[], { merge: false }>();
  if (error) throw error;

  // T170 — out-of-office backup approver: a task pinned to a specific
  // assignee_id (e.g. an "Additional Approval" pick) surfaces in the
  // backup's inbox too while the primary approver has an active delegation.
  const delegatedFrom = userId === 'guest' ? [] : await getUsersWhoDelegatedToMe(userId);

  // Administrator sees every in-progress task (also the effective behavior
  // while there's no login and every visitor is the GUEST_USER Administrator
  // — see src/lib/server/users.ts).
  const mine = userRole === 'Administrator' ? instances : instances.filter(i =>
    i.assignee_role === userRole || (i.assignee_id != null && delegatedFrom.includes(i.assignee_id)));
  if (mine.length === 0) return [];

  const { data: invoices, error: invErr } = await createServiceClient()
    .from('invoices').select('*').in('id', mine.map(i => i.invoice_id))
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (invErr) throw invErr;

  return mine.map(instance => {
    const invoice = invoices.find(inv => inv.id === instance.invoice_id);
    const task = wfById(instance.wf_id).tasks[instance.task_idx];
    return {
      instance, invoiceCode: invoice?.code ?? '—', vendor: invoice?.vendor ?? '—',
      amount: invoice?.total ?? 0, currentTaskName: task?.name ?? '—',
    };
  });
}
