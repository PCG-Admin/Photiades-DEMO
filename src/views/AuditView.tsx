'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { Avatar, Badge, PageHeader } from '@/components/ui';
import { cx } from '@/lib/utils';
import { fmtTime } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import type { AuditEventRow } from '@/lib/supabase/types';

const MODULES: AuditEventRow['module'][] = ['Invoices', 'Capture', 'Approvals', 'Admin', 'Reports', 'Auth', 'Workflows'];

// =================== AUDIT TRAIL ===================
// SOW §5.7 — every row here is append-only (audit_events has no update/delete
// policy); "changes" renders the field-level before/after capture (T150).
export function AuditView({ initialEvents }: { initialEvents: AuditEventRow[] }) {
  const [q, setQ] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const modules = ['All', ...MODULES];
  let rows = initialEvents;
  if (moduleFilter !== 'All') rows = rows.filter(r => r.module === moduleFilter);
  if (q) rows = rows.filter(r => (r.actor_name + r.action + (r.target || '') + r.code).toLowerCase().includes(q.toLowerCase()));

  // group by day
  const groups: Record<string, AuditEventRow[]> = {};
  rows.forEach(r => {
    const key = new Date(r.occurred_at).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' });
    (groups[key] = groups[key] || []).push(r);
  });

  function exportLog() {
    downloadCsv('audit-log.csv', rows.map(r => ({
      time: r.occurred_at, actor: r.actor_name, role: r.actor_role, action: r.action,
      target: r.target ?? '', module: r.module,
      changes: r.changes ? r.changes.map(c => `${c.field}: ${c.before ?? ''} -> ${c.after ?? ''}`).join('; ') : '',
    })));
  }

  return (
    <div className="view-enter">
      <PageHeader title="Audit Trail" sub="Immutable, time-stamped log of every action across the portal."
        actions={<button className="btn" onClick={exportLog}><I.download size={15} />Export log</button>} />

      <div className="card" style={{ marginBottom: 'var(--gap-5)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="search" style={{ width: 300, padding: '6px 12px' }}>
          <I.search size={15} />
          <input placeholder="Search actor, action, or record…" value={q} onChange={e => setQ(e.target.value)} />
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
          {rows.length === 0 && <div className="empty"><I.audit size={32} /><div style={{ marginTop: 10 }}>No audit events yet</div></div>}
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

function AuditRow({ e }: { e: AuditEventRow }) {
  const Ico = (e.icon && I[e.icon]) || I.doc;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)' } as Record<string, string>)[e.tone ?? 'gray'];
  const softVar = ({ blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)' } as Record<string, string>)[e.tone ?? 'gray'];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      <span className="faint mono" style={{ fontSize: 11.5, width: 46, flexShrink: 0, marginTop: 2 }}>{fmtTime(new Date(e.occurred_at))}</span>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: softVar, color: toneVar, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={15} /></div>
      <Avatar name={e.actor_name} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{e.actor_name}</span>
          <span className="muted"> {e.action} </span>
          {e.target && <span className="mono" style={{ fontSize: 12, color: 'var(--accent-strong)' }}>{e.target}</span>}
        </div>
        {e.changes && e.changes.length > 0 && (
          <div className="faint mono" style={{ fontSize: 11, marginTop: 3 }}>
            {e.changes.map(c => `${c.field}: ${String(c.before ?? '—')} → ${String(c.after ?? '—')}`).join(' · ')}
          </div>
        )}
      </div>
      <Badge tone="gray">{e.module}</Badge>
      <span className="faint mono" style={{ fontSize: 10.5, width: 90, textAlign: 'right' }}>{e.code}</span>
    </div>
  );
}
