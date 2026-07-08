'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { I } from '@/components/icons';
import { Badge, Avatar, Segmented, PageHeader, MiniStat } from '@/components/ui';
import { fmtMoney } from '@/lib/utils';
import { RelativeTime } from '@/components/RelativeTime';
import { useToast } from '@/components/providers/ToastProvider';
import { useGo } from '@/lib/navigation';
import {
  WORKFLOWS, wfById, ACTION_TONE_VAR, ACTION_SOFT_VAR,
  type WFTask, type WFAction, type WFField, type WFBranch,
} from '@/lib/workflow';
import {
  advanceWorkflowTask, getWorkflowInstanceDetail,
  type WorkflowInstanceListItem, type WorkflowInstanceDetail,
} from '@/lib/server/workflows';
import { listAppUsers } from '@/lib/server/users';
import { errorMessage } from '@/lib/errorMessage';
import { useTr } from '@/lib/i18n';

type Invoice = { invNo: string; po: string | null; amount: number };

// WorkflowHistoryRow.fields is jsonb (typed as Json); every history row this
// app writes is a flat string/number map, so treat it as one for display.
function fieldsOf(fields: unknown): Record<string, unknown> {
  return typeof fields === 'object' && fields !== null ? fields as Record<string, unknown> : {};
}

// =================== WORKFLOWS LIST ===================
export function WorkflowsView({ initialInstances, initialOpen = null }: { initialInstances: WorkflowInstanceListItem[]; initialOpen?: string | null }) {
  const tr = useTr();
  const toast = useToast();
  const go = useGo();
  const [instances, setInstances] = useState<WorkflowInstanceListItem[]>(initialInstances);
  const [open, setOpen] = useState<string | null>(initialOpen);
  const [wfId, setWfId] = useState('stock');

  function refreshOne(updatedCode: string, patch: Partial<WorkflowInstanceListItem['instance']>) {
    setInstances(prev => prev.map(x => x.instance.code === updatedCode ? { ...x, instance: { ...x.instance, ...patch } } : x));
  }

  if (open) {
    return <WorkflowRunner code={open} onBack={() => setOpen(null)} toast={toast} go={go}
      onUpdate={(patch) => refreshOne(open, patch)} />;
  }

  const wf = wfById(wfId);
  const tasks = wf.tasks;
  const statusTone: Record<string, string> = { 'In Progress': 'blue', 'Info Requested': 'amber', 'Declined': 'red', 'Completed': 'green', 'Pending Payment': 'teal', 'Order not placed via PD': 'gray' };
  const wfInstances = instances.filter(i => i.instance.wf_id === wfId);
  const active = wfInstances.filter(i => i.instance.status === 'In Progress' || i.instance.status === 'Info Requested');
  const branch = tasks.find(t => t.auto)?.branch;

  return (
    <div className="view-enter">
      <PageHeader title={tr('Workflows')} sub={tr('Invoice approval workflows — track and action in-flight items.')}
        actions={<button className="btn"><I.settings size={15} />{tr('Workflow designer')}</button>} />

      {/* Workflow switcher */}
      <div style={{ marginBottom: 'var(--gap-5)' }}>
        <Segmented options={WORKFLOWS.map(w => ({ value: w.id, label: w.name }))} value={wfId} onChange={(v) => setWfId(String(v))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label={tr('Active workflows')} value={active.length} sub={tr('in progress')} tone="blue" />
        <MiniStat label={tr('In approval')} value={wfInstances.filter(i => i.instance.status === 'In Progress' && i.instance.task_idx > 0).length} tone="violet" />
        <MiniStat label={tr('Info requested')} value={wfInstances.filter(i => i.instance.status === 'Info Requested').length} tone="amber" />
        <MiniStat label={tr('Total value in flight')} value={fmtMoney(active.reduce((s, i) => s + i.amount, 0))} tone="green" />
      </div>

      {/* Workflow definition strip */}
      <div className="card" style={{ marginBottom: 'var(--gap-5)', padding: '16px 20px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-title">{wf.name}</div>
          <Badge tone="blue" dot>{tasks.filter(t => !t.auto).length} {tr('tasks')}</Badge>
        </div>
        <div className="row" style={{ gap: 0, flexWrap: 'wrap', rowGap: 8 }}>
          {tasks.map((t, i) => (
            <React.Fragment key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: t.auto ? 'var(--violet-soft)' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ width: 24, height: 24, borderRadius: 99, background: t.auto ? 'var(--violet)' : 'var(--accent)', color: 'white', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
                  <div className="faint" style={{ fontSize: 10.5 }}>{t.role}</div>
                </div>
              </div>
              {i < tasks.length - 1 && <I.arrowR size={16} style={{ color: 'var(--faint)', margin: '0 6px' }} />}
            </React.Fragment>
          ))}
        </div>
        {branch && (
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="faint" style={{ fontSize: 11.5 }}>{tr('Amount check branch:')}</span>
            <Badge tone="teal">&gt; €{branch.threshold} → {branch.over}</Badge>
            <Badge tone="gray">≤ €{branch.threshold} → {branch.under} ({tr('skips')} {tasks[branch.skipIdx].name})</Badge>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head"><div className="card-title">{tr('In-flight workflows')}</div><Badge tone="gray">{wfInstances.length}</Badge></div>
        <table className="tbl">
          <thead>
            <tr><th>{tr('Workflow')}</th><th>{tr('Vendor')}</th><th className="right">{tr('Amount')}</th><th>{tr('Current task')}</th><th>{tr('Status')}</th><th>{tr('Started')}</th><th style={{ width: 40 }}></th></tr>
          </thead>
          <tbody>
            {wfInstances.map(({ instance: inst, invoiceCode, vendor, po, amount }) => (
              <tr key={inst.id} className="clickable" onClick={() => setOpen(inst.code)}>
                <td>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)' }}>{inst.code}</div>
                  <div className="faint mono" style={{ fontSize: 11 }}>{invoiceCode} · {po || tr('No PO')}</div>
                </td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{vendor}</td>
                <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(amount)}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{inst.task_idx + 1}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{tasks[inst.task_idx]?.name}</div>
                      <div className="faint" style={{ fontSize: 10.5 }}>{tasks[inst.task_idx]?.role}</div>
                    </div>
                  </div>
                </td>
                <td><Badge tone={statusTone[inst.status]} dot>{tr(inst.status)}</Badge></td>
                <td className="faint" style={{ fontSize: 12 }}><RelativeTime date={new Date(inst.started_at)} /></td>
                <td><I.chevR size={16} style={{ color: 'var(--faint)' }} /></td>
              </tr>
            ))}
            {wfInstances.length === 0 && (
              <tr><td colSpan={7} className="faint" style={{ padding: 20, textAlign: 'center', fontSize: 13 }}>{tr('No instances yet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================== WORKFLOW RUNNER ===================
function WorkflowRunner({ code, onBack, toast, go, onUpdate }: {
  code: string;
  onBack: () => void;
  toast: (msg: string) => void;
  go: ReturnType<typeof useGo>;
  onUpdate: (patch: Partial<WorkflowInstanceDetail>) => void;
}) {
  const tr = useTr();
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selAction, setSelAction] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [approvers, setApprovers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, users] = await Promise.all([getWorkflowInstanceDetail(code), listAppUsers()]);
      if (cancelled) return;
      setDetail(d);
      setApprovers(users.map(u => u.name));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [code]);

  async function reload() {
    const d = await getWorkflowInstanceDetail(code);
    setDetail(d);
    if (d) onUpdate(d);
  }

  if (loading || !detail) {
    return (
      <div className="view-enter">
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />{tr('Workflows')}</button>
        <div className="empty" style={{ marginTop: 40 }}><I.zap size={32} /><div style={{ marginTop: 10 }}>{tr('Loading workflow…')}</div></div>
      </div>
    );
  }

  const wf = wfById(detail.wf_id);
  const tasks = wf.tasks;
  const task = tasks[detail.task_idx];
  const branch = tasks.find(t => t.auto)?.branch;
  const invoice: Invoice = { invNo: detail.invoiceCode, po: detail.po, amount: detail.amount };
  const terminal = ['Declined', 'Order not placed via PD'].includes(detail.status);
  const isComplete = detail.status === 'Completed';
  const isPendingPmt = detail.status === 'Pending Payment';

  // an "additional" action pauses the instance at the same task, awaiting
  // additionalGrant/additionalDecline — recovered from the last history row.
  const lastHistory = detail.history[detail.history.length - 1];
  const additionalPending = (!terminal && !isComplete && !isPendingPmt && lastHistory?.action_key === 'additional' && lastHistory.task_id === task.id)
    ? { approver: String(fieldsOf(lastHistory.fields).approver ?? 'Unknown'), fromTask: detail.task_idx }
    : null;

  function selectAction(a: WFAction) {
    setSelAction(a.key);
    const initial: Record<string, string | number> = {};
    a.fields.forEach(f => {
      if (f.src) initial[f.k] = invoice[f.src as keyof Invoice] as string | number;
      else initial[f.k] = '';
    });
    setForm(initial);
  }
  const setField = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function submitAction(actionKey: string, fieldsOverride?: Record<string, string | number>) {
    if (!detail) return;
    setSubmitting(true);
    try {
      await advanceWorkflowTask(detail.id, actionKey, fieldsOverride ?? form);
      await reload();
      setSelAction(null); setForm({});
      toast('Workflow updated');
    } catch (err) {
      toast(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const statusTone: Record<string, string> = { 'In Progress': 'blue', 'Info Requested': 'amber', 'Declined': 'red', 'Completed': 'green', 'Pending Payment': 'teal', 'Order not placed via PD': 'gray' };

  return (
    <div className="view-enter">
      <div className="row" style={{ gap: 14, marginBottom: 'var(--gap-5)', flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />{tr('Workflows')}</button>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }} className="mono">{detail.code}</h2>
            <Badge tone={statusTone[detail.status]} dot>{tr(detail.status)}</Badge>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{wf.name} · {detail.vendor}</div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => go('invoices', detail.invoiceCode)}><I.invoice size={15} />{tr('View invoice')}</button>
      </div>

      {/* facts bar */}
      <div className="card" style={{ display: 'flex', gap: 0, marginBottom: 'var(--gap-5)', overflow: 'hidden' }}>
        {[
          { l: tr('Invoice'), v: detail.invoiceCode, mono: true },
          { l: tr('PO Number'), v: detail.po || tr('No PO'), mono: true },
          { l: tr('Amount'), v: fmtMoney(detail.amount), mono: true, big: true },
        ].map((f, i) => (
          <div key={f.l} style={{ flex: 1, padding: '14px 20px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
            <div className="muted" style={{ fontSize: 11 }}>{f.l}</div>
            <div className={f.mono ? 'mono' : ''} style={{ fontSize: f.big ? 18 : 14, fontWeight: f.big ? 700 : 600, marginTop: 4 }}>{f.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--gap-5)', alignItems: 'start' }}>
        {/* Task timeline */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="card-head"><div className="card-title">{tr('Workflow tasks')}</div></div>
          <div className="card-pad">
            <WFTimeline tasks={tasks} taskIdx={detail.task_idx} terminal={terminal} isComplete={isComplete} isPendingPmt={isPendingPmt} additionalPending={additionalPending} amount={detail.amount} branch={branch} />
          </div>
        </div>

        {/* Active task panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
          {terminal ? (
            <TerminalCard status={detail.status} />
          ) : isComplete ? (
            <CompletedCard amount={detail.amount} />
          ) : isPendingPmt ? (
            <PendingPaymentCard />
          ) : additionalPending ? (
            <AdditionalCard approver={additionalPending.approver} invoice={invoice} submitting={submitting}
              onResolve={(grant) => submitAction(grant ? 'additionalGrant' : 'additionalDecline', {})} />
          ) : task.auto ? (
            <AmountCheckCard amount={detail.amount} branch={branch} submitting={submitting} onConfirm={() => submitAction('routeAmountCheck', {})} />
          ) : (
            <ActiveTaskCard task={task} taskIdx={detail.task_idx} selAction={selAction} onSelect={selectAction}
              form={form} setField={setField} invoice={invoice} approvers={approvers} submitting={submitting}
              onSubmit={() => submitAction(selAction!)} onCancel={() => setSelAction(null)} />
          )}

          {/* History */}
          <div className="card">
            <div className="card-head"><div className="card-title">{tr('Workflow history')}</div><Badge tone="gray">{detail.history.length}</Badge></div>
            <div style={{ padding: '8px 0' }}>
              {detail.history.length === 0 && <div className="faint" style={{ fontSize: 12.5, padding: '10px 20px' }}>{tr('No actions yet')}</div>}
              {detail.history.map((h, i) => {
                const action = tasks.find(t => t.id === h.task_id)?.actions?.find(a => a.key === h.action_key);
                const tone = action?.tone ?? (h.action_key.includes('Grant') ? 'green' : h.action_key.includes('Decline') ? 'red' : 'gray');
                return (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: i < detail.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: ACTION_TONE_VAR(tone), marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13 }}><span style={{ fontWeight: 600 }}>{h.actor_name}</span> <span className="muted">· {h.task_name}</span></div>
                      <div style={{ fontSize: 12.5, color: ACTION_TONE_VAR(tone), fontWeight: 600, marginTop: 1 }}>{h.action_label}</div>
                      {typeof fieldsOf(h.fields).com === 'string' && Boolean(fieldsOf(h.fields).com) && <div className="muted" style={{ fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>&ldquo;{String(fieldsOf(h.fields).com)}&rdquo;</div>}
                    </div>
                    <span className="faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}><RelativeTime date={new Date(h.occurred_at)} /></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WFTimeline({ tasks, taskIdx, terminal, isComplete, isPendingPmt, additionalPending, amount, branch }: {
  tasks: WFTask[];
  taskIdx: number;
  terminal: boolean;
  isComplete: boolean;
  isPendingPmt: boolean;
  additionalPending: { approver: string; fromTask: number } | null;
  amount: number;
  branch?: WFBranch;
}) {
  const tr = useTr();
  const finished = isComplete || isPendingPmt;
  const branchIdx = branch ? tasks.findIndex(t => t.auto) : -1;
  const lowValueRouted = branch != null && amount <= branch.threshold && (taskIdx > branchIdx || finished || terminal);
  return (
    <div>
      {tasks.map((t, i) => {
        const skipped = branch && i === branch.skipIdx && lowValueRouted;
        const done = !skipped && (i < taskIdx || (finished && i <= taskIdx));
        const active = i === taskIdx && !terminal && !finished;
        const isTerminalHere = terminal && i === taskIdx;
        const last = i === tasks.length - 1;
        return (
          <div key={t.id} style={{ display: 'flex', gap: 13, opacity: skipped ? 0.5 : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0, zIndex: 1,
                background: isTerminalHere ? 'var(--red)' : skipped ? 'var(--surface-3)' : done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--surface-3)',
                color: (done || active || isTerminalHere) ? 'white' : 'var(--faint)',
                boxShadow: active ? '0 0 0 4px var(--accent-ring)' : 'none',
              }}>
                {isTerminalHere ? <I.x size={15} stroke={3} /> : skipped ? <span style={{ fontSize: 13, fontWeight: 600 }}>–</span> : done ? <I.check size={15} stroke={3} /> : <span style={{ fontSize: 13, fontWeight: active ? 700 : 600 }}>{i + 1}</span>}
              </div>
              {!last && <div style={{ width: 2, flex: 1, minHeight: 40, background: done ? 'var(--green)' : 'var(--border)' }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 22, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
              <div className="faint" style={{ fontSize: 11.5, marginBottom: 6 }}>{t.role}</div>
              {skipped && <Badge tone="gray">{tr('Skipped')} · ≤ €{branch!.threshold}</Badge>}
              {!skipped && active && additionalPending && <Badge tone="violet" dot>{tr('Awaiting additional approval')}</Badge>}
              {!skipped && active && !additionalPending && <Badge tone="blue" dot>{tr('Current')}</Badge>}
              {!skipped && done && <Badge tone="green">{tr('Done')}</Badge>}
              {last && isComplete && <div style={{ marginTop: 6 }}><Badge tone="green" dot>{tr('Workflow complete')}</Badge></div>}
              {last && isPendingPmt && <div style={{ marginTop: 6 }}><Badge tone="teal" dot>{tr('Pending payment')}</Badge></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActiveTaskCard({ task, taskIdx, selAction, onSelect, form, setField, invoice, approvers, submitting, onSubmit, onCancel }: {
  task: WFTask;
  taskIdx: number;
  selAction: string | null;
  onSelect: (a: WFAction) => void;
  form: Record<string, string | number>;
  setField: (k: string, v: string | number) => void;
  invoice: Invoice;
  approvers: string[];
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const tr = useTr();
  const action = task.actions!.find(a => a.key === selAction);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="row" style={{ gap: 9 }}>
            <div style={{ width: 24, height: 24, borderRadius: 99, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{taskIdx + 1}</div>
            <div className="card-title">{task.name}</div>
          </div>
          <div className="card-sub" style={{ marginTop: 6 }}>{task.desc}</div>
        </div>
        <Badge tone="blue">{task.role}</Badge>
      </div>
      <div className="card-pad">
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 11 }}>{tr('Choose an action')}</div>
        <div className="row" style={{ gap: 9, flexWrap: 'wrap', marginBottom: selAction ? 22 : 0 }}>
          {task.actions!.map(a => {
            const Ico = I[a.icon] || I.check;
            const on = selAction === a.key;
            return (
              <button key={a.key} onClick={() => onSelect(a)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 8,
                  border: `1.5px solid ${on ? ACTION_TONE_VAR(a.tone) : 'var(--border-strong)'}`,
                  background: on ? ACTION_SOFT_VAR(a.tone) : 'var(--surface)',
                  color: on ? ACTION_TONE_VAR(a.tone) : 'var(--text-2)',
                  fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
                }}>
                <Ico size={15} />{a.label}
              </button>
            );
          })}
        </div>

        {action && (
          <div style={{ animation: 'fadeUp 0.2s', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
              {action.fields.map(f => (
                <WFFieldEl key={f.k} f={f} value={form[f.k]} onChange={(v) => setField(f.k, v)} invoice={invoice} approvers={approvers} />
              ))}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onCancel} disabled={submitting}>{tr('Cancel')}</button>
              <button className="btn" style={{ background: ACTION_TONE_VAR(action.tone), color: 'white', borderColor: 'transparent' }} onClick={onSubmit} disabled={submitting}>
                <I.send size={15} />{submitting ? tr('Submitting…') : `${tr('Submit')} · ${action.label}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WFFieldEl({ f, value, onChange, invoice, approvers }: {
  f: WFField;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
  invoice: Invoice;
  approvers: string[];
}) {
  const tr = useTr();
  const full = ['textarea'].includes(f.type) || f.k === 'approver';
  const isRO = f.type === 'ro' || f.type === 'ro-currency';
  const displayRO = f.type === 'ro-currency' ? fmtMoney(invoice[f.src as keyof Invoice] as number) : invoice[f.src as keyof Invoice];
  const options = f.k === 'approver' ? approvers : f.options;
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
        {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
        {isRO && <span className="faint" style={{ fontWeight: 400 }}> · {tr('from invoice')}</span>}
      </label>
      {isRO ? (
        <div className="input mono" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 7 }}>
          <I.shield size={13} style={{ color: 'var(--faint)' }} />{displayRO}
        </div>
      ) : f.type === 'textarea' ? (
        <textarea className="input" rows={2} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={tr('Enter comment…')} style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
      ) : f.type === 'select' ? (
        <select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">{tr('— Select —')}</option>
          {options?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === 'currency' ? (
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>€</span>
          <input className="input mono" style={{ paddingLeft: 24, textAlign: 'right' }} value={value ?? ''} onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))} />
        </div>
      ) : (
        <input className="input mono" value={value || ''} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

function AmountCheckCard({ amount, branch, submitting, onConfirm }: { amount: number; branch?: WFBranch; submitting: boolean; onConfirm: () => void }) {
  const tr = useTr();
  const threshold = branch?.threshold ?? 500;
  const over = amount > threshold;
  const dest = over ? (branch?.over ?? 'PurchMgr-Approval') : (branch?.under ?? 'AM - AcDep-Review');
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{tr('Amount check')}</div>
          <div className="card-sub" style={{ marginTop: 6 }}>{tr('Automatic threshold check determines the next approver.')}</div>
        </div>
        <Badge tone="violet" dot>{tr('System')}</Badge>
      </div>
      <div className="card-pad">
        <div className="row" style={{ gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: 16, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11.5 }}>{tr('Invoice amount')}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{fmtMoney(amount)}</div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--faint)', fontWeight: 600 }}>{over ? '>' : '≤'}</div>
          <div style={{ flex: 1, padding: 16, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11.5 }}>{tr('Threshold')}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{fmtMoney(threshold)}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)', marginBottom: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            <I.zap size={17} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13 }}>{tr('This invoice will route to')} <strong>{dest}</strong>.</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={onConfirm} disabled={submitting}><I.arrowR size={15} />{submitting ? tr('Routing…') : `${tr('Route to')} ${dest}`}</button>
        </div>
      </div>
    </div>
  );
}

function AdditionalCard({ approver, invoice, submitting, onResolve }: {
  approver: string;
  invoice: Invoice;
  submitting: boolean;
  onResolve: (approve: boolean) => void;
}) {
  const tr = useTr();
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{tr('Additional approval pending')}</div>
        <Badge tone="violet" dot>{tr('Awaiting')} {approver.split(' ')[0]}</Badge>
      </div>
      <div className="card-pad">
        <div className="row" style={{ gap: 12, marginBottom: 18 }}>
          <Avatar name={approver} size={40} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{approver}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>{tr('Requested to provide additional approval for')} {fmtMoney(invoice.amount)}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn danger" onClick={() => onResolve(false)} disabled={submitting}><I.x size={15} />{tr('Decline')}</button>
          <button className="btn success" onClick={() => onResolve(true)} disabled={submitting}><I.check size={15} />{tr('Grant approval')}</button>
        </div>
      </div>
    </div>
  );
}

function TerminalCard({ status }: { status: string }) {
  const tr = useTr();
  const isDecline = status === 'Declined';
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: isDecline ? 'var(--red-soft)' : 'var(--surface-3)', color: isDecline ? 'var(--red)' : 'var(--muted)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        {isDecline ? <I.x size={28} stroke={2.5} /> : <I.flag size={26} />}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{tr(status)}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 360, marginInline: 'auto' }}>
        {isDecline ? tr('This workflow was declined and has ended. The importer has been notified.') : tr('This invoice was marked as not placed via the Purchasing Department. The workflow has ended.')}
      </div>
    </div>
  );
}

function CompletedCard({ amount }: { amount: number }) {
  const tr = useTr();
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <I.check size={28} stroke={2.5} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{tr('Workflow complete')}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>
        {tr('The Accounts Department has given final approval. This invoice')} ({fmtMoney(amount)}) {tr('has cleared all approval stages and is released for posting and payment.')}
      </div>
    </div>
  );
}

function PendingPaymentCard() {
  const tr = useTr();
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <I.clock size={26} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{tr('Pending payment')}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>
        {tr('The Accounts Department has approved this invoice and placed it on hold pending payment. It will be released to the payment run once funds are scheduled.')}
      </div>
    </div>
  );
}
