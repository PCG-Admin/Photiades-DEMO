'use client';

/* Dashboard view */
import * as React from 'react';
import { I, IconComponent } from '@/components/icons';
import { Badge, Kpi, BarChart, Donut, Segmented, PageHeader } from '@/components/ui';
import { fmtNum } from '@/lib/utils';
import { INVOICES, AUDIT, DASHBOARD, relTime } from '@/lib/data';
import type { AuditEvent } from '@/lib/data';
import { useGo } from '@/lib/navigation';
import { useTr } from '@/lib/i18n';

export function DashboardView() {
  const go = useGo();
  const tr = useTr();
  const d = DASHBOARD;
  const exceptions = INVOICES.filter(i => i.status === 'Exception');
  const recent = AUDIT.slice(0, 7);
  const maxPipe = d.workflowTasks[0].count;

  return (
    <div className="view-enter">
      <PageHeader
        title="Good morning, Elena"
        sub="Thursday, 29 May 2026 · Here's what needs your attention across the portal."
        actions={<>
          <button className="btn" onClick={() => go('reports')}><I.reports size={16} />{tr('View reports')}</button>
          <button className="btn primary" onClick={() => go('capture')}><I.upload size={16} />{tr('Capture document')}</button>
        </>}
      />

      <div className="kpi-grid stagger" style={{ marginBottom: 'var(--gap-5)' }}>
        <div style={{ animationDelay: '0ms' }}><Kpi label={tr('Documents captured')} value={fmtNum(d.kpis.captured.value)} delta={d.kpis.captured.delta} deltaDir="up" sub={tr('this month')} icon={I.capture} tone="teal" /></div>
        <div style={{ animationDelay: '60ms' }}><Kpi label={tr('Invoices pending')} value={d.kpis.pending.value} delta={d.kpis.pending.delta} deltaDir="up" sub={tr('vs. yesterday')} icon={I.invoice} tone="amber" /></div>
        <div style={{ animationDelay: '120ms' }}><Kpi label={tr('Awaiting your approval')} value={d.kpis.awaitingYou.value} delta={d.kpis.awaitingYou.delta} deltaDir="down" sub={tr('2 high priority')} icon={I.approve} tone="blue" /></div>
        <div style={{ animationDelay: '180ms' }}><Kpi label={tr('Avg. processing time')} value={d.kpis.avgCycle.value} delta={d.kpis.avgCycle.delta} deltaDir="down" sub={tr('22% faster')} icon={I.clock} tone="green" /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--gap-5)', marginBottom: 'var(--gap-5)' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {d.workflowTasks.map((s, i) => (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 99, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ width: 132, fontSize: 12.5, fontWeight: 500, color: 'var(--text-2)' }}>{s.stage}</div>
                  <div style={{ flex: 1, position: 'relative', height: 24 }}>
                    <div style={{
                      position: 'absolute', inset: 0, width: `${(s.count / maxPipe) * 100}%`,
                      background: s.color, borderRadius: 6, opacity: 0.9,
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 9,
                      transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)', minWidth: 40,
                      animation: `growBar 0.7s cubic-bezier(0.22,1,0.36,1)`,
                    }}>
                      <span className="mono tnum" style={{ fontSize: 11.5, fontWeight: 600, color: 'white' }}>{fmtNum(s.count)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Status mix donut */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{tr('Invoice status')}</div>
            <button className="icon-btn" onClick={() => go('invoices')}><I.arrowR size={16} /></button>
          </div>
          <div className="card-pad" style={{ display: 'grid', placeItems: 'center', paddingTop: 28 }}>
            <Donut data={d.statusMix} size={158} thickness={24} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 'var(--gap-5)', marginBottom: 'var(--gap-5)' }}>
        {/* Volume chart */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{tr('Capture volume')}</div>
              <div className="card-sub">{tr('Documents ingested this week')}</div>
            </div>
            <Segmented options={[{ value: 'Week', label: tr('Week') }, { value: 'Month', label: tr('Month') }]} value="Week" onChange={() => {}} />
          </div>
          <div className="card-pad">
            <BarChart data={d.volume} height={170} valueFmt={(v) => `${v} docs`} />
          </div>
        </div>

        {/* Stock / Non-stock mix donut */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{tr('Stock vs Non-stock')}</div>
              <div className="card-sub">{tr('Indexed invoices · this month')}</div>
            </div>
            <button className="icon-btn" onClick={() => go('workflows')}><I.arrowR size={16} /></button>
          </div>
          <div className="card-pad" style={{ display: 'grid', placeItems: 'center', paddingTop: 24, paddingBottom: 24 }}>
            <Donut data={d.stockMix} size={150} thickness={23} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--gap-5)' }}>
        {/* Action queue */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">{tr('Needs your attention')}</div>
            <Badge tone="amber">{exceptions.length + 6} {tr('items')}</Badge>
          </div>
          <div style={{ padding: '6px 0' }}>
            <ActionRow icon={I.approve} tone="blue" title={tr('6 invoices awaiting your approval')}
              sub={tr('2 are high priority · oldest 2 days')} onClick={() => go('workflows')} />
            <ActionRow icon={I.alert} tone="red" title={`${exceptions.length} ${tr('invoices with exceptions')}`}
              sub={tr('PO mismatch & duplicate detection')} onClick={() => go('invoices')} />
            <ActionRow icon={I.flag} tone="amber" title={tr('4 documents need manual review')}
              sub={tr('Low OCR confidence on key fields')} onClick={() => go('capture')} />
            <ActionRow icon={I.clock} tone="violet" title={tr('3 approvals approaching SLA')}
              sub={tr('Due within 24 hours')} onClick={() => go('workflows')} />
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
          {recent.map((e) => <ActivityRow key={e.id} e={e} />)}
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

function ActivityRow({ e }: { e: AuditEvent }) {
  const Ico = I[e.icon] || I.doc;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)' } as Record<string, string>)[e.tone];
  const softVar = ({ blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)', red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)' } as Record<string, string>)[e.tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: softVar, color: toneVar, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={15} /></div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{e.user}</span>
        <span className="muted"> {e.action} </span>
        {e.target && <span className="mono" style={{ fontSize: 12, color: 'var(--accent-strong)' }}>{e.target}</span>}
      </div>
      <span className="faint" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{relTime(e.when)}</span>
    </div>
  );
}
