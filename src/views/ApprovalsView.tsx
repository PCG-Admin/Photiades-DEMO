'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { Badge, PageHeader, MiniStat, Segmented } from '@/components/ui';
import { ApprovalChain } from '@/components/ApprovalChain';
import { fmtMoney } from '@/lib/utils';
import { APPROVALS, relTime, fmtDate, type Approval } from '@/lib/data';
import { useGo } from '@/lib/navigation';
import { useToast } from '@/components/providers/ToastProvider';

// =================== APPROVALS ===================
export function ApprovalsView() {
  const toast = useToast();
  const go = useGo();
  const [items, setItems] = useState<Approval[]>(APPROVALS);
  const [sel, setSel] = useState<Approval | null>(APPROVALS[0]);
  const [filter, setFilter] = useState('Pending');

  function act(item: Approval, action: string) {
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast(action === 'approve' ? `${item.id} approved` : `${item.id} rejected`);
    setSel(() => {
      const remaining = items.filter(i => i.id !== item.id);
      return remaining[0] || null;
    });
  }

  const prioTone: Record<string, string> = { High: 'red', Medium: 'amber', Low: 'gray' };

  return (
    <div className="view-enter">
      <PageHeader title="Approvals" sub="Review and action requests routed to you and your team."
        actions={<button className="btn"><I.settings size={15} />Approval rules</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Awaiting you" value={items.length} sub="across 6 types" tone="blue" />
        <MiniStat label="Approaching SLA" value="3" sub="due in 24h" tone="amber" />
        <MiniStat label="Total value pending" value={fmtMoney(items.reduce((s, i) => s + i.amount, 0))} tone="violet" />
        <MiniStat label="Approved this week" value="47" sub="avg 1.8d cycle" tone="green" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 'var(--gap-5)', height: 'calc(100vh - 290px)' }}>
        {/* Inbox list */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-head" style={{ padding: '12px 16px' }}>
            <Segmented options={['Pending', 'All']} value={filter} onChange={(v) => setFilter(String(v))} />
            <Badge tone="amber">{items.length}</Badge>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.length === 0 && <div className="empty"><I.check size={32} /><div style={{ marginTop: 10 }}>All caught up!</div></div>}
            {items.map(item => (
              <button key={item.id} onClick={() => setSel(item)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none',
                  borderBottom: '1px solid var(--border)', borderLeft: sel?.id === item.id ? '3px solid var(--accent)' : '3px solid transparent',
                  background: sel?.id === item.id ? 'var(--accent-softer)' : 'transparent',
                  padding: '14px 16px', transition: 'background 0.1s',
                }}>
                <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                  <Badge tone="blue">{item.type}</Badge>
                  <Badge tone={prioTone[item.priority]} dot>{item.priority}</Badge>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8, lineHeight: 1.35 }}>{item.title}</div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                  <span className="num" style={{ fontWeight: 600, fontSize: 13 }}>{fmtMoney(item.amount)}</span>
                  <span className="faint" style={{ fontSize: 11.5 }}>{item.requester.split(' ')[0]} · {relTime(item.submitted)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        {sel ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="card-head">
              <div>
                <div className="row" style={{ gap: 9 }}>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-strong)' }}>{sel.id}</span>
                  <Badge tone={prioTone[sel.priority]} dot>{sel.priority} priority</Badge>
                </div>
                <div className="card-title" style={{ marginTop: 6 }}>{sel.title}</div>
              </div>
              <button className="btn ghost sm" onClick={() => go('invoices', sel.ref)}>View source<I.arrowR size={14} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--gap-5)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 24 }}>
                <DetailField label="Amount" value={fmtMoney(sel.amount)} big />
                <DetailField label="Requested by" value={sel.requester} />
                <DetailField label="Department" value={sel.dept} />
                <DetailField label="Linked reference" value={sel.ref} mono />
                <DetailField label="Submitted" value={fmtDate(sel.submitted)} />
                <DetailField label="SLA deadline" value={`In ${sel.dueIn} days`} tone={sel.dueIn <= 1 ? 'red' : undefined} />
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14 }}>Approval chain</div>
              <ApprovalChain steps={sel.chain} amount={sel.amount} />

              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', margin: '24px 0 12px' }}>Justification</div>
              <div className="card" style={{ padding: 14, background: 'var(--surface-2)', fontSize: 13, lineHeight: 1.6, color: 'var(--text-2)' }}>
                Routine {sel.type.toLowerCase()} for {sel.dept}. All supporting documentation attached and 3-way match completed. Within budget allocation for Q2 2026.
              </div>
            </div>
            <div style={{ padding: 'var(--gap-4) var(--gap-5)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input className="input" placeholder="Add comment…" style={{ flex: 1 }} />
              <button className="btn danger" onClick={() => act(sel, 'reject')}><I.x size={15} />Reject</button>
              <button className="btn success" onClick={() => act(sel, 'approve')}><I.check size={15} />Approve</button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="empty"><I.approve size={36} /><div style={{ marginTop: 12, fontWeight: 500 }}>Nothing selected</div><div style={{ fontSize: 12.5 }}>Pick a request from the inbox</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value, big, mono, tone }: {
  label: string; value: React.ReactNode; big?: boolean; mono?: boolean; tone?: string;
}) {
  const c = tone === 'red' ? 'var(--red)' : 'var(--text)';
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5 }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: big ? 22 : 14, fontWeight: big ? 700 : 600, marginTop: 3, color: c, fontFamily: big || mono ? 'var(--mono)' : 'var(--font)' }}>{value}</div>
    </div>
  );
}
