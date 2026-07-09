'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { Badge, PageHeader, MiniStat } from '@/components/ui';
import { fmtMoney } from '@/lib/utils';
import { RelativeTime } from '@/components/RelativeTime';
import { useGo } from '@/lib/navigation';
import { useTr } from '@/lib/i18n';
import type { ApprovalInboxItem } from '@/lib/server/workflows';

function priorityOf(amount: number): 'High' | 'Medium' | 'Low' {
  return amount > 50000 ? 'High' : amount > 15000 ? 'Medium' : 'Low';
}

// =================== APPROVALS ===================
// Derived entirely from workflow_instances (SOW's only real approval
// mechanism) — never a separate table. Selecting an item hands off to
// WorkflowsView to actually act on the task, rather than duplicating the
// per-task action UI here.
export function ApprovalsView({ initialItems }: { initialItems: ApprovalInboxItem[] }) {
  const tr = useTr();
  const go = useGo();
  const [items] = useState<ApprovalInboxItem[]>(initialItems);
  const [selCode, setSelCode] = useState<string | null>(initialItems[0]?.instance.code ?? null);

  const sel = items.find(i => i.instance.code === selCode) ?? null;

  return (
    <div className="view-enter">
      <PageHeader title={tr('Approvals')} sub={tr('Stock and Non-Stock invoice workflow tasks awaiting a decision.')}
        actions={<button className="btn" onClick={() => go('workflows')}><I.zap size={15} />{tr('Open Workflows')}</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label={tr('Awaiting a decision')} value={items.length} sub={tr('across both workflows')} tone="blue" />
        <MiniStat label={tr('Total value pending')} value={fmtMoney(items.reduce((s, i) => s + i.amount, 0))} tone="violet" />
        <MiniStat label={tr('High priority')} value={items.filter(i => priorityOf(i.amount) === 'High').length} sub="> €50,000" tone="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--gap-5)', height: 'calc(100vh - 290px)' }}>
        {/* Inbox list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-head" style={{ padding: '12px 16px' }}>
            <span className="card-title">{tr('Inbox')}</span>
            <Badge tone="amber">{items.length}</Badge>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.length === 0 && <div className="empty"><I.check size={32} /><div style={{ marginTop: 10 }}>{tr('All caught up!')}</div></div>}
            {items.map(item => {
              const priority = priorityOf(item.amount);
              const prioTone: Record<string, string> = { High: 'red', Medium: 'amber', Low: 'gray' };
              const on = sel?.instance.code === item.instance.code;
              return (
                <button key={item.instance.id} onClick={() => setSelCode(item.instance.code)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', border: 'none',
                    borderBottom: '1px solid var(--border)', borderLeft: on ? '3px solid var(--accent)' : '3px solid transparent',
                    background: on ? 'var(--accent-softer)' : 'transparent',
                    padding: '14px 16px', transition: 'background 0.1s',
                  }}>
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                    <Badge tone="blue">{tr(item.currentTaskName)}</Badge>
                    {item.instance.status === 'Info Requested'
                      ? <Badge tone="amber" dot>{tr('Info Requested')}</Badge>
                      : <Badge tone={prioTone[priority]} dot>{tr(priority)}</Badge>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8, lineHeight: 1.35 }}>{item.vendor}</div>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <span className="num" style={{ fontWeight: 600, fontSize: 13 }}>{fmtMoney(item.amount)}</span>
                    <span className="faint" style={{ fontSize: 11.5 }}>{item.invoiceCode} · <RelativeTime date={new Date(item.instance.started_at)} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        {sel ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card-head">
              <div>
                <div className="row" style={{ gap: 9 }}>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{sel.instance.code}</span>
                  <Badge tone={{ High: 'red', Medium: 'amber', Low: 'gray' }[priorityOf(sel.amount)]} dot>{tr(priorityOf(sel.amount))} {tr('priority')}</Badge>
                </div>
                <div className="card-title" style={{ marginTop: 6 }}>{sel.vendor} — {tr(sel.currentTaskName)}</div>
              </div>
              <button className="btn ghost sm" onClick={() => go('invoices', sel.invoiceCode)}>{tr('View invoice')}<I.arrowR size={14} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--gap-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 24 }}>
                <DetailField label={tr('Amount')} value={fmtMoney(sel.amount)} big />
                <DetailField label={tr('Invoice')} value={sel.invoiceCode} mono />
                <DetailField label={tr('Current task')} value={tr(sel.currentTaskName)} />
                <DetailField label={tr('Assigned role')} value={tr(sel.instance.assignee_role)} />
                <DetailField label={tr('Started')} value={<RelativeTime date={new Date(sel.instance.started_at)} />} />
                <DetailField label={tr('Workflow')} value={sel.instance.wf_id === 'stock' ? tr('Stock') : tr('Non-Stock')} />
              </div>
              {sel.instance.status === 'Info Requested' ? (
                <div className="card" style={{ padding: 14, background: 'var(--amber-soft)', border: '1px solid var(--amber)', fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                  {tr('More information was requested — AP Clerk has been notified to update the invoice. This task stays assigned to you and can be actioned again once the invoice is updated.')}
                </div>
              ) : (
                <div className="card" style={{ padding: 14, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                  {tr('Awaiting')} <strong>{tr(sel.currentTaskName)}</strong> — {tr('open Workflows to review the full task history and submit a decision.')}
                </div>
              )}
            </div>
            <div style={{ padding: 'var(--gap-4) var(--gap-5)', borderTop: '1px solid var(--border)' }}>
              <button className="btn primary" style={{ width: '100%' }} onClick={() => go('workflows')}><I.zap size={15} />{tr('Open in Workflows')}</button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="empty"><I.approve size={36} /><div style={{ marginTop: 12, fontWeight: 500 }}>{tr('Nothing selected')}</div><div style={{ fontSize: 12.5 }}>{tr('Pick a request from the inbox')}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value, big, mono }: {
  label: string; value: React.ReactNode; big?: boolean; mono?: boolean;
}) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: big ? 22 : 14, fontWeight: big ? 700 : 600, marginTop: 3, fontFamily: big || mono ? 'var(--mono)' : 'var(--font)' }}>{value}</div>
    </div>
  );
}
