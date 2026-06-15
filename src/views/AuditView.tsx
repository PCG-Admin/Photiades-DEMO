'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { Avatar, Badge, PageHeader } from '@/components/ui';
import { cx } from '@/lib/utils';
import { AUDIT, fmtTime, type AuditEvent } from '@/lib/data';

// =================== AUDIT TRAIL ===================
export function AuditView() {
  const [q, setQ] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const modules = ['All', 'Invoices', 'Capture', 'Approvals', 'Admin', 'Reports', 'Auth'];
  let rows = AUDIT;
  if (moduleFilter !== 'All') rows = rows.filter(r => r.module === moduleFilter);
  if (q) rows = rows.filter(r => (r.user + r.action + (r.target || '') + r.id).toLowerCase().includes(q.toLowerCase()));

  // group by day
  const groups: Record<string, AuditEvent[]> = {};
  rows.forEach(r => {
    const key = r.when.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' });
    (groups[key] = groups[key] || []).push(r);
  });

  return (
    <div className="view-enter">
      <PageHeader title="Audit Trail" sub="Immutable, time-stamped log of every action across the portal."
        actions={<>
          <button className="btn"><I.filter size={15} />Advanced filter</button>
          <button className="btn"><I.download size={15} />Export log</button>
        </>} />

      <div className="card" style={{ marginBottom: 'var(--gap-5)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="search" style={{ width: 300, padding: '6px 12px' }}>
          <I.search size={15} />
          <input placeholder="Search user, action, or record…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {modules.map(m => (
            <button key={m} className={cx('btn sm', moduleFilter === m && 'primary')} onClick={() => setModuleFilter(m)}>{m}</button>
          ))}
        </div>
        <div className="spacer" />
        <span className="muted" style={{ fontSize: 12.5 }}><span className="mono">{rows.length}</span> events</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
          {Object.entries(groups).map(([day, events]) => (
            <div key={day}>
              <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', padding: '8px 20px', fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.03em' }}>{day}</div>
              {events.map(e => <AuditRow key={e.id} e={e} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditRow({ e }: { e: AuditEvent }) {
  const Ico = I[e.icon] || I.doc;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)' } as Record<string, string>)[e.tone];
  const softVar = ({ blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)' } as Record<string, string>)[e.tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span className="faint mono" style={{ fontSize: 11.5, width: 46, flexShrink: 0 }}>{fmtTime(e.when)}</span>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: softVar, color: toneVar, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={15} /></div>
      <Avatar name={e.user} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{e.user}</span>
        <span className="muted"> {e.action} </span>
        {e.target && <span className="mono" style={{ fontSize: 12, color: 'var(--accent-strong)' }}>{e.target}</span>}
      </div>
      <Badge tone="gray">{e.module}</Badge>
      <span className="faint mono" style={{ fontSize: 11, width: 100, textAlign: 'right' }}>{e.ip}</span>
      <span className="faint mono" style={{ fontSize: 10.5, width: 78, textAlign: 'right' }}>{e.id}</span>
    </div>
  );
}
