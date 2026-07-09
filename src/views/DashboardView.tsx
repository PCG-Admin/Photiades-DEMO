'use client';

/* Dashboard view */
import * as React from 'react';
import { I, IconComponent } from '@/components/icons';
import { Badge, Kpi, Donut, PageHeader } from '@/components/ui';
import { RelativeTime } from '@/components/RelativeTime';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';
import { useGo } from '@/lib/navigation';
import { useTr } from '@/lib/i18n';
import { fmtMoney } from '@/lib/utils';
import type { DashboardData } from '@/lib/server/dashboard';
import type { AuditEventRow } from '@/lib/supabase/types';

export function DashboardView({ data, recentActivity }: { data: DashboardData; recentActivity: AuditEventRow[] }) {
  const go = useGo();
  const tr = useTr();
  const currentUser = useCurrentUser();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="view-enter">
      <PageHeader
        title={`${tr('Welcome,')} ${currentUser.name.split(' ')[0]}`}
        sub={`${today} · ${tr("Here's what needs your attention across the portal.")}`}
        actions={<>
          <button className="btn" onClick={() => go('reports')}><I.reports size={16} />{tr('View reports')}</button>
          <button className="btn primary" onClick={() => go('capture')}><I.upload size={16} />{tr('Capture document')}</button>
        </>}
      />

      <div className="kpi-grid stagger" style={{ marginBottom: 'var(--gap-5)' }}>
        <div style={{ animationDelay: '0ms' }}><Kpi label={tr('Invoices captured')} value={data.totalInvoices} icon={I.invoice} tone="teal" /></div>
        <div style={{ animationDelay: '60ms' }}><Kpi label={tr('Workflows in progress')} value={data.inProgressWorkflows} icon={I.zap} tone="amber" /></div>
        <div style={{ animationDelay: '120ms' }}><Kpi label={tr('Invoices with exceptions')} value={data.exceptions} icon={I.alert} tone="red" /></div>
        <div style={{ animationDelay: '180ms' }}><Kpi label={tr('Total outstanding')} value={fmtMoney(data.totalOutstandingValue)} icon={I.building} tone="violet" /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.85fr 0.85fr', gap: 'var(--gap-5)', marginBottom: 'var(--gap-5)' }}>
        {/* Workflow tasks */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{tr('Workflow tasks')}</div>
              <div className="card-sub">{tr('Invoices currently at each task')}</div>
            </div>
            <button className="btn ghost sm" onClick={() => go('workflows')}>{tr('Open')}<I.arrowR size={14} /></button>
          </div>
          <div className="card-pad">
            {data.workflowTasks.length === 0 ? (
              <div className="faint" style={{ fontSize: 13 }}>{tr('No invoices in-flight yet.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.workflowTasks.map((s) => {
                  const max = Math.max(...data.workflowTasks.map(t => t.count));
                  return (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 160, fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={tr(s.stage)}>{tr(s.stage)}</div>
                      <div style={{ flex: 1, position: 'relative', height: 24 }}>
                        <div style={{
                          position: 'absolute', inset: 0, width: `${Math.max(6, (s.count / max) * 100)}%`,
                          background: s.color, borderRadius: 6, opacity: 0.9,
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 9, minWidth: 30,
                          transition: 'width 0.5s cubic-bezier(.22,1,.36,1)',
                        }}>
                          <span className="mono tnum" style={{ fontSize: 11.5, fontWeight: 600, color: 'white' }}>{s.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status mix donut */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{tr('Invoice status')}</div>
            <button className="icon-btn" onClick={() => go('invoices')}><I.arrowR size={16} /></button>
          </div>
          <div className="card-pad" style={{ display: 'grid', placeItems: 'center', paddingTop: 28 }}>
            {data.statusMix.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No invoices yet.')}</div> : <Donut data={data.statusMix} size={130} thickness={20} />}
          </div>
        </div>

        {/* Stock vs Non-stock mix donut */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{tr('Stock vs Non-stock')}</div>
            <button className="icon-btn" onClick={() => go('invoices')}><I.arrowR size={16} /></button>
          </div>
          <div className="card-pad" style={{ display: 'grid', placeItems: 'center', paddingTop: 28 }}>
            {data.stockMix.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No invoices yet.')}</div> : <Donut data={data.stockMix} size={130} thickness={20} />}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--gap-5)' }}>
        {/* Action queue */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{tr('Needs your attention')}</div>
            <Badge tone="amber">{data.inProgressWorkflows + data.exceptions} {tr('items')}</Badge>
          </div>
          <div style={{ padding: '6px 0' }}>
            <ActionRow icon={I.approve} tone="blue" title={`${data.inProgressWorkflows} ${tr('invoices awaiting a workflow decision')}`}
              sub={tr('Open Workflows to act')} onClick={() => go('workflows')} />
            <ActionRow icon={I.alert} tone="red" title={`${data.exceptions} ${tr('invoices with exceptions')}`}
              sub={tr('Flagged during capture or review')} onClick={() => go('invoices')} />
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">{tr('Recent activity')}</div>
          <button className="btn ghost sm" onClick={() => go('audit')}>{tr('View audit trail')}<I.arrowR size={14} /></button>
        </div>
        <div style={{ padding: '8px 0' }}>
          {recentActivity.length === 0 && <div className="faint" style={{ fontSize: 12.5, padding: '10px 20px' }}>{tr('No activity yet')}</div>}
          {recentActivity.map((e) => <ActivityRow key={e.id} e={e} />)}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon, tone, title, sub, onClick }: {
  icon: IconComponent; tone: string; title: React.ReactNode; sub: React.ReactNode; onClick?: () => void;
}) {
  const Ico = icon;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)' } as Record<string, string>)[tone];
  const softVar = ({ blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)' } as Record<string, string>)[tone];
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '11px 20px', border: 'none', background: 'none', textAlign: 'left', transition: 'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: softVar, color: toneVar, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{sub}</div>
      </div>
      <I.chevR size={16} stroke={2} />
    </button>
  );
}

function ActivityRow({ e }: { e: AuditEventRow }) {
  const Ico = (e.icon && I[e.icon]) || I.doc;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)' } as Record<string, string>)[e.tone ?? 'gray'];
  const softVar = ({ blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)' } as Record<string, string>)[e.tone ?? 'gray'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: softVar, color: toneVar, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={15} /></div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{e.actor_name}</span>
        <span className="muted"> {e.action} </span>
        {e.target && <span className="mono" style={{ fontSize: 12, color: 'var(--accent-strong)' }}>{e.target}</span>}
      </div>
      <span className="faint" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}><RelativeTime date={new Date(e.occurred_at)} /></span>
    </div>
  );
}
