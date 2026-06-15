'use client';

import * as React from 'react';
import { useState } from 'react';
import { I } from '@/components/icons';
import { Badge, Avatar, Segmented, PageHeader, MiniStat } from '@/components/ui';
import { fmtMoney } from '@/lib/utils';
import { CURRENT_USER, relTime, daysAgo } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';
import {
  WORKFLOWS, wfById, WF_INSTANCES, ACTION_TONE_VAR, ACTION_SOFT_VAR,
  type WFTask, type WFAction, type WFField, type WFInstance, type WFBranch,
} from '@/lib/workflow';

type HistoryEntry = {
  task: string;
  action: string;
  by: string;
  when: Date;
  tone: string;
  fields?: Record<string, string | number>;
};

type Invoice = { invNo: string; po: string | null; amount: number };

// =================== WORKFLOWS LIST ===================
export function WorkflowsView() {
  const toast = useToast();
  const [instances, setInstances] = useState<WFInstance[]>(WF_INSTANCES);
  const [open, setOpen] = useState<string | null>(null);
  const [wfId, setWfId] = useState('stock');

  const updateInstance = (id: string, patch: Partial<WFInstance>) => setInstances(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));

  if (open) {
    const inst = instances.find(x => x.id === open)!;
    return <WorkflowRunner inst={inst} onBack={() => setOpen(null)} toast={toast}
      onUpdate={(patch) => updateInstance(open, patch)} />;
  }

  const wf = wfById(wfId);
  const tasks = wf.tasks;
  const statusTone: Record<string, string> = { 'In Progress': 'blue', 'Info Requested': 'amber', 'Declined': 'red', 'Completed': 'green', 'Pending Payment': 'teal', 'Order not placed via PD': 'gray' };
  const wfInstances = instances.filter(i => i.wfId === wfId);
  const active = wfInstances.filter(i => i.status === 'In Progress' || i.status === 'Info Requested');
  const branch = tasks.find(t => t.auto)?.branch;

  return (
    <div className="view-enter">
      <PageHeader title="Workflows" sub="Invoice approval workflows — track and action in-flight items."
        actions={<button className="btn"><I.settings size={15} />Workflow designer</button>} />

      {/* Workflow switcher */}
      <div style={{ marginBottom: 'var(--gap-5)' }}>
        <Segmented options={WORKFLOWS.map(w => ({ value: w.id, label: w.name }))} value={wfId} onChange={(v) => setWfId(String(v))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Active workflows" value={active.length} sub="in progress" tone="blue" />
        <MiniStat label="In approval" value={wfInstances.filter(i => i.status === 'In Progress' && i.taskIdx > 0).length} tone="violet" />
        <MiniStat label="Info requested" value={wfInstances.filter(i => i.status === 'Info Requested').length} tone="amber" />
        <MiniStat label="Total value in flight" value={fmtMoney(active.reduce((s, i) => s + i.amount, 0))} tone="green" />
      </div>

      {/* Workflow definition strip */}
      <div className="card" style={{ marginBottom: 'var(--gap-5)', padding: '16px 20px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="card-title">{wf.name}</div>
          <Badge tone="blue" dot>{tasks.filter(t => !t.auto).length} tasks</Badge>
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
            <span className="faint" style={{ fontSize: 11.5 }}>Amount check branch:</span>
            <Badge tone="teal">&gt; €{branch.threshold} → {branch.over}</Badge>
            <Badge tone="gray">≤ €{branch.threshold} → {branch.under} (skips {tasks[branch.skipIdx].name})</Badge>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head"><div className="card-title">In-flight workflows</div><Badge tone="gray">{wfInstances.length}</Badge></div>
        <table className="tbl">
          <thead>
            <tr><th>Workflow</th><th>Vendor</th><th className="right">Amount</th><th>Current task</th><th>Status</th><th>Started</th><th style={{ width: 40 }}></th></tr>
          </thead>
          <tbody>
            {wfInstances.map(inst => (
              <tr key={inst.id} className="clickable" onClick={() => setOpen(inst.id)}>
                <td>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)' }}>{inst.id}</div>
                  <div className="faint mono" style={{ fontSize: 11 }}>{inst.invNo} · {inst.po}</div>
                </td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{inst.vendor}</td>
                <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(inst.amount)}</td>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{inst.taskIdx + 1}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{tasks[inst.taskIdx].name}</div>
                      <div className="faint" style={{ fontSize: 10.5 }}>{tasks[inst.taskIdx].role}</div>
                    </div>
                  </div>
                </td>
                <td><Badge tone={statusTone[inst.status]} dot>{inst.status}</Badge></td>
                <td className="faint" style={{ fontSize: 12 }}>{relTime(inst.started)}</td>
                <td><I.chevR size={16} style={{ color: 'var(--faint)' }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================== WORKFLOW RUNNER ===================
function WorkflowRunner({ inst, onBack, toast, onUpdate }: {
  inst: WFInstance;
  onBack: () => void;
  toast: (msg: string) => void;
  onUpdate: (patch: Partial<WFInstance>) => void;
}) {
  const wf = wfById(inst.wfId);
  const tasks = wf.tasks;
  // editable invoice fields (editable at Task 1, read-only after)
  const [invoice, setInvoice] = useState<{ invNo: string; po: string | null; amount: number }>({ invNo: inst.invNo, po: inst.po, amount: inst.amount });
  const [taskIdx, setTaskIdx] = useState<number>(inst.taskIdx);
  const [status, setStatus] = useState<string>(inst.status);
  const [history, setHistory] = useState<HistoryEntry[]>(() => [{ task: tasks[0].name, action: 'Workflow started', by: 'System', when: inst.started, tone: 'gray' }]);
  const [selAction, setSelAction] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [additionalPending, setAdditionalPending] = useState<{ approver: string; fromTask: number } | null>(null);
  const [routing, setRouting] = useState<string | null>(null);

  const task = tasks[taskIdx];
  const branch = tasks.find(t => t.auto)?.branch;
  const terminal = ['Declined', 'Order not placed via PD'].includes(status);
  const isComplete = status === 'Completed';
  const isPendingPmt = status === 'Pending Payment';

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

  // advance to the next task; if past the end → Completed
  function advanceTo(nextIdx: number, label: string) {
    if (nextIdx >= tasks.length) {
      setStatus('Completed'); onUpdate({ status: 'Completed' });
      toast(`${label} — workflow complete`); return;
    }
    setTaskIdx(nextIdx); setStatus('In Progress');
    onUpdate({ taskIdx: nextIdx, status: 'In Progress' });
    toast(`${label} — sent to ${tasks[nextIdx].name}`);
  }

  function submit() {
    const action = task.actions!.find(a => a.key === selAction)!;
    const missing = action.fields.find(f => f.required && !String(form[f.k] || '').trim());
    if (missing) { toast(`${missing.label} is required`); return; }

    // persist edited invoice fields from the import task (index 0)
    let nextInvoice = invoice;
    if (taskIdx === 0 && selAction === 'approved') {
      nextInvoice = { invNo: String(form.invNo), po: form.po == null ? null : String(form.po), amount: Number(form.amount) || invoice.amount };
      setInvoice(nextInvoice);
      onUpdate({ invNo: nextInvoice.invNo, po: nextInvoice.po, amount: nextInvoice.amount });
    }

    setHistory(h => [...h, { task: task.name, action: action.label, by: CURRENT_USER.name, when: daysAgo(0), tone: action.tone, fields: { ...form } }]);
    setSelAction(null); setForm({});

    // ---- generic state transitions ----
    if (action.key === 'declined') { setStatus('Declined'); onUpdate({ status: 'Declined' }); toast('Workflow declined'); return; }
    if (action.key === 'notPlaced') { setStatus('Order not placed via PD'); onUpdate({ status: 'Order not placed via PD' }); toast('Marked: order not placed via PD'); return; }
    if (action.key === 'pendPmt') { setStatus('Pending Payment'); onUpdate({ status: 'Pending Payment' }); toast('Marked pending payment'); return; }
    if (action.key === 'requestInfo') { setStatus('Info Requested'); setTaskIdx(0); onUpdate({ status: 'Info Requested', taskIdx: 0 }); toast('Info requested — returned to importer'); return; }
    if (action.key === 'additional') { setAdditionalPending({ approver: String(form.approver), fromTask: taskIdx }); toast(`Routed to ${form.approver} for additional approval`); return; }
    // forward (approved / reviewed)
    advanceTo(taskIdx + 1, action.label);
  }

  function resolveAdditional(approve: boolean) {
    const from = additionalPending!.fromTask;
    setHistory(h => [...h, { task: tasks[from].name, action: approve ? 'Additional approval granted' : 'Additional approval declined', by: additionalPending!.approver, when: daysAgo(0), tone: approve ? 'green' : 'red' }]);
    setAdditionalPending(null);
    if (!approve) { setStatus('Declined'); onUpdate({ status: 'Declined' }); toast('Additional approval declined'); return; }
    advanceTo(from + 1, 'Additional approval granted');
  }

  function confirmRouting() {
    const over = invoice.amount > branch!.threshold;
    const destIdx = over ? branch!.overIdx : branch!.underIdx;
    setRouting(over ? branch!.over : branch!.under);
    setTaskIdx(destIdx);
    setHistory(h => [...h, { task: task.name, action: `Routed to ${tasks[destIdx].name}`, by: 'System', when: daysAgo(0), tone: 'teal' }]);
    onUpdate({ taskIdx: destIdx });
    toast(`Routed to ${tasks[destIdx].name}`);
  }

  const statusTone: Record<string, string> = { 'In Progress': 'blue', 'Info Requested': 'amber', 'Declined': 'red', 'Completed': 'green', 'Pending Payment': 'teal', 'Order not placed via PD': 'gray' };

  return (
    <div className="view-enter">
      <div className="row" style={{ gap: 14, marginBottom: 'var(--gap-5)', flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />Workflows</button>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }} className="mono">{inst.id}</h2>
            <Badge tone={statusTone[status]} dot>{status}</Badge>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{wf.name} · {inst.vendor}</div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => toast('Opening linked invoice…')}><I.invoice size={15} />View invoice</button>
      </div>

      {/* facts bar */}
      <div className="card" style={{ display: 'flex', gap: 0, marginBottom: 'var(--gap-5)', overflow: 'hidden' }}>
        {[
          { l: 'Invoice Number', v: invoice.invNo, mono: true },
          { l: 'PO Number', v: invoice.po, mono: true },
          { l: 'Amount', v: fmtMoney(invoice.amount), mono: true, big: true },
          { l: 'Linked invoice', v: inst.invId, mono: true },
        ].map((f, i) => (
          <div key={f.l} style={{ flex: 1, padding: '14px 20px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div className="muted" style={{ fontSize: 11 }}>{f.l}</div>
            <div className={f.mono ? 'mono' : ''} style={{ fontSize: f.big ? 18 : 14, fontWeight: f.big ? 700 : 600, marginTop: 4 }}>{f.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--gap-5)', alignItems: 'start' }}>
        {/* Task timeline */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="card-head"><div className="card-title">Workflow tasks</div></div>
          <div className="card-pad">
            <WFTimeline tasks={tasks} taskIdx={taskIdx} routing={routing} terminal={terminal} isComplete={isComplete} isPendingPmt={isPendingPmt} additionalPending={additionalPending} amount={invoice.amount} branch={branch} />
          </div>
        </div>

        {/* Active task panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
          {terminal ? (
            <TerminalCard status={status} />
          ) : isComplete ? (
            <CompletedCard amount={invoice.amount} />
          ) : isPendingPmt ? (
            <PendingPaymentCard />
          ) : additionalPending ? (
            <AdditionalCard approver={additionalPending.approver} invoice={invoice} onResolve={resolveAdditional} />
          ) : task.auto ? (
            <AmountCheckCard amount={invoice.amount} onConfirm={confirmRouting} />
          ) : (
            <ActiveTaskCard task={task} taskIdx={taskIdx} selAction={selAction} onSelect={selectAction}
              form={form} setField={setField} invoice={invoice} onSubmit={submit} onCancel={() => setSelAction(null)} />
          )}

          {/* History */}
          <div className="card">
            <div className="card-head"><div className="card-title">Workflow history</div><Badge tone="gray">{history.length}</Badge></div>
            <div style={{ padding: '8px 0' }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 99, background: ACTION_TONE_VAR(h.tone), marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}><span style={{ fontWeight: 600 }}>{h.by}</span> <span className="muted">· {h.task}</span></div>
                    <div style={{ fontSize: 12.5, color: ACTION_TONE_VAR(h.tone), fontWeight: 600, marginTop: 1 }}>{h.action}</div>
                    {h.fields?.com && <div className="muted" style={{ fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>“{h.fields.com}”</div>}
                  </div>
                  <span className="faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{relTime(h.when)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WFTimeline({ tasks, taskIdx, routing, terminal, isComplete, isPendingPmt, additionalPending, amount, branch }: {
  tasks: WFTask[];
  taskIdx: number;
  routing: string | null;
  terminal: boolean;
  isComplete: boolean;
  isPendingPmt: boolean;
  additionalPending: { approver: string; fromTask: number } | null;
  amount: number;
  branch?: WFBranch;
}) {
  const finished = isComplete || isPendingPmt;
  const branchIdx = branch ? tasks.findIndex(t => t.auto) : -1;
  const lowValueRouted = branch && amount <= branch.threshold && (taskIdx > branchIdx || finished || terminal);
  return (
    <div>
      {tasks.map((t, i) => {
        const skipped = branch && i === branch.skipIdx && lowValueRouted; // skipped on ≤ threshold path
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
              {skipped && <Badge tone="gray">Skipped · ≤ €{branch!.threshold}</Badge>}
              {!skipped && active && additionalPending && <Badge tone="violet" dot>Awaiting additional approval</Badge>}
              {!skipped && active && !additionalPending && <Badge tone="blue" dot>Current</Badge>}
              {!skipped && done && <Badge tone="green">Done</Badge>}
              {branch && i === branchIdx && routing && <div style={{ marginTop: 6 }}><Badge tone="teal" dot>→ {routing}</Badge></div>}
              {last && isComplete && <div style={{ marginTop: 6 }}><Badge tone="green" dot>Workflow complete</Badge></div>}
              {last && isPendingPmt && <div style={{ marginTop: 6 }}><Badge tone="teal" dot>Pending payment</Badge></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActiveTaskCard({ task, taskIdx, selAction, onSelect, form, setField, invoice, onSubmit, onCancel }: {
  task: WFTask;
  taskIdx: number;
  selAction: string | null;
  onSelect: (a: WFAction) => void;
  form: Record<string, string | number>;
  setField: (k: string, v: string | number) => void;
  invoice: { invNo: string; po: string | null; amount: number };
  onSubmit: () => void;
  onCancel: () => void;
}) {
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
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 11 }}>Choose an action</div>
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
                <WFFieldEl key={f.k} f={f} value={form[f.k]} onChange={(v) => setField(f.k, v)} invoice={invoice} />
              ))}
            </div>
            <div className="row" style={{ gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={onCancel}>Cancel</button>
              <button className="btn" style={{ background: ACTION_TONE_VAR(action.tone), color: 'white', borderColor: 'transparent' }} onClick={onSubmit}>
                <I.send size={15} />Submit · {action.label}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WFFieldEl({ f, value, onChange, invoice }: {
  f: WFField;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
  invoice: { invNo: string; po: string | null; amount: number };
}) {
  const full = ['textarea'].includes(f.type) || f.k === 'approver';
  const isRO = f.type === 'ro' || f.type === 'ro-currency';
  const displayRO = f.type === 'ro-currency' ? fmtMoney(invoice[f.src as keyof Invoice] as number) : invoice[f.src as keyof Invoice];
  return (
    <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
        {f.label}{f.required && <span style={{ color: 'var(--red)' }}> *</span>}
        {isRO && <span className="faint" style={{ fontWeight: 400 }}> · from invoice</span>}
      </label>
      {isRO ? (
        <div className="input mono" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 7 }}>
          <I.shield size={13} style={{ color: 'var(--faint)' }} />{displayRO}
        </div>
      ) : f.type === 'textarea' ? (
        <textarea className="input" rows={f.k === 'com' || f.k === 'comStored' ? 2 : 2} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder="Enter comment…" style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
      ) : f.type === 'select' ? (
        <select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">— Select —</option>
          {f.options!.map(o => <option key={o}>{o}</option>)}
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

function AmountCheckCard({ amount, onConfirm }: { amount: number; onConfirm: () => void }) {
  const over = amount > 500;
  const dest = over ? 'PurchMgr-Approval' : 'AM - AcDep-Review';
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="row" style={{ gap: 9 }}>
            <div style={{ width: 24, height: 24, borderRadius: 99, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>3</div>
            <div className="card-title">Amount check over 500</div>
          </div>
          <div className="card-sub" style={{ marginTop: 6 }}>Automatic threshold check determines the next approver.</div>
        </div>
        <Badge tone="violet" dot>System</Badge>
      </div>
      <div className="card-pad">
        <div className="row" style={{ gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, padding: 16, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11.5 }}>Invoice amount</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{fmtMoney(amount)}</div>
          </div>
          <div style={{ fontSize: 20, color: 'var(--faint)', fontWeight: 600 }}>{over ? '>' : '≤'}</div>
          <div style={{ flex: 1, padding: 16, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div className="muted" style={{ fontSize: 11.5 }}>Threshold</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>€500.00</div>
          </div>
        </div>

        {/* branch diagram */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
          <div style={{ padding: 14, borderRadius: 10, border: `1.5px solid ${over ? 'var(--teal)' : 'var(--border)'}`, background: over ? 'var(--teal-soft)' : 'var(--surface-2)', opacity: over ? 1 : 0.55 }}>
            <div className="row" style={{ gap: 8 }}><I.arrowUp size={14} style={{ color: 'var(--teal)' }} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>Over €500</span></div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>PurchMgr-Approval</div>
          </div>
          <div style={{ padding: 14, borderRadius: 10, border: `1.5px solid ${!over ? 'var(--accent)' : 'var(--border)'}`, background: !over ? 'var(--accent-soft)' : 'var(--surface-2)', opacity: !over ? 1 : 0.55 }}>
            <div className="row" style={{ gap: 8 }}><I.arrowDown size={14} style={{ color: 'var(--accent)' }} /><span style={{ fontSize: 12.5, fontWeight: 600 }}>€500 or under</span></div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>AM - AcDep-Review</div>
            <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>skips PurchMgr</div>
          </div>
        </div>

        <div className="card" style={{ padding: '12px 16px', background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)', marginBottom: 18 }}>
          <div className="row" style={{ gap: 10 }}>
            <I.zap size={17} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13 }}>This invoice will route to <strong>{dest}</strong>.</span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary" onClick={onConfirm}><I.arrowR size={15} />Route to {dest}</button>
        </div>
      </div>
    </div>
  );
}

function AdditionalCard({ approver, invoice, onResolve }: {
  approver: string;
  invoice: { invNo: string; po: string | null; amount: number };
  onResolve: (approve: boolean) => void;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">Additional approval pending</div>
        <Badge tone="violet" dot>Awaiting {approver.split(' ')[0]}</Badge>
      </div>
      <div className="card-pad">
        <div className="row" style={{ gap: 12, marginBottom: 18 }}>
          <Avatar name={approver} size={40} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{approver}</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Requested to provide additional approval for {fmtMoney(invoice.amount)}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', background: 'var(--surface-2)', marginBottom: 18, fontSize: 12.5, color: 'var(--text-2)' }}>
          Acting as <strong>{approver}</strong> for this prototype — choose to grant or decline the additional approval.
        </div>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn danger" onClick={() => onResolve(false)}><I.x size={15} />Decline</button>
          <button className="btn success" onClick={() => onResolve(true)}><I.check size={15} />Grant approval</button>
        </div>
      </div>
    </div>
  );
}

function TerminalCard({ status }: { status: string }) {
  const isDecline = status === 'Declined';
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: isDecline ? 'var(--red-soft)' : 'var(--surface-3)', color: isDecline ? 'var(--red)' : 'var(--muted)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        {isDecline ? <I.x size={28} stroke={2.5} /> : <I.flag size={26} />}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>{status}</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 360, marginInline: 'auto' }}>
        {isDecline ? 'This workflow was declined and has ended. The importer has been notified.' : 'This invoice was marked as not placed via the Purchasing Department. The workflow has ended.'}
      </div>
    </div>
  );
}

function CompletedCard({ amount }: { amount: number }) {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <I.check size={28} stroke={2.5} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>Workflow complete</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>
        The Accounts Department has given final approval. This {amount > 500 ? 'over-€500' : '≤ €500'} invoice has cleared all approval stages and is released for posting and payment.
      </div>
    </div>
  );
}

function PendingPaymentCard() {
  return (
    <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--teal-soft)', color: 'var(--teal)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
        <I.clock size={26} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 600 }}>Pending payment</div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 400, marginInline: 'auto' }}>
        The Accounts Department has approved this invoice and placed it on hold pending payment. It will be released to the payment run once funds are scheduled.
      </div>
    </div>
  );
}
