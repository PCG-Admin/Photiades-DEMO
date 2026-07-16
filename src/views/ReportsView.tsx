'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { I, type IconComponent } from '@/components/icons';
import { Badge, MiniStat, PageHeader, Pagination, Segmented, usePagination } from '@/components/ui';
import { fmtMoney } from '@/lib/utils';
import { fmtDate } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { downloadXlsx } from '@/lib/xlsx';
import { useTr } from '@/lib/i18n';
import {
  getInvoiceAging, getApprovalSLA, getApproverPerformance, getDeclinedTrend, getPendingPayments, exportInvoices,
  type AgingBucket, type SlaRow, type ApproverPerformanceRow, type DeclinedRow, type InvoiceExportFilters,
} from '@/lib/server/reports';
import type { InvoiceRow } from '@/lib/supabase/types';

const PERIODS: { key: string; label: string; days: number | null }[] = [
  { key: 'all', label: 'All time', days: null },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: '365', label: 'Last 12 months', days: 365 },
];

// =================== REPORTS — SOW §5.6 ===================
// All six reports on one scrolling page (previously behind tabs) with a
// single period filter at the top — applies to the history-driven reports
// (Approval SLA / Approver Performance / Declined Invoices), since those
// aggregate dated workflow_history rows. Invoice Aging and Pending Payments
// are current-state snapshots ("what's outstanding right now"), so the
// period filter doesn't apply to them; Custom Export has its own
// vendor/status filters and stays a separate section at the bottom.
const EXPORT_STATUSES = ['Awaiting Approval', 'Pending Payment', 'Order not placed via PD', 'Approved', 'Paid Invoice', 'Declined'];

export function ReportsView() {
  const tr = useTr();
  const [periodKey, setPeriodKey] = useState('all');
  const periodDays = PERIODS.find(p => p.key === periodKey)?.days ?? null;

  // Custom Export's filters live here (not inside CustomExportReport) so
  // every filter control on this page — period AND vendor/status — sits in
  // one bar at the top, instead of a second, disconnected filter row way
  // down at the bottom of the page.
  const [exportFilters, setExportFilters] = useState<InvoiceExportFilters>({});
  const [exportRows, setExportRows] = useState<InvoiceRow[] | null>(null);
  const [exportRunning, setExportRunning] = useState(false);
  async function runExport() {
    setExportRunning(true);
    setExportRows(await exportInvoices(exportFilters));
    setExportRunning(false);
  }

  return (
    <div className="view-enter">
      <PageHeader title={tr('Reports & Analytics')} sub={tr('The six SOW §5.6 reports — Invoice Aging, Approval SLA, Approver Performance, Declined Invoices, Pending Payments, and a custom filter export.')} />

      <div className="card card-pad" style={{ marginBottom: 'var(--gap-6)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('Period')}</span>
          <Segmented options={PERIODS.map(p => ({ value: p.key, label: tr(p.label) }))} value={periodKey} onChange={(v) => setPeriodKey(String(v))} />
          <span className="faint" style={{ fontSize: 11.5 }}>{tr('Applies to Approval SLA, Approver Performance, and Declined Invoices')}</span>
        </div>
        <div className="divider" />
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('Custom export')}</span>
          <input className="input" placeholder={tr('Vendor contains…')} style={{ maxWidth: 220 }}
            value={exportFilters.vendor ?? ''} onChange={e => setExportFilters(f => ({ ...f, vendor: e.target.value || undefined }))} />
          <select className="input" style={{ maxWidth: 200 }} value={exportFilters.status ?? ''} onChange={e => setExportFilters(f => ({ ...f, status: e.target.value || undefined }))}>
            <option value="">{tr('Any status')}</option>
            {EXPORT_STATUSES.map(s => <option key={s} value={s}>{tr(s)}</option>)}
          </select>
          <button className="btn primary" onClick={runExport} disabled={exportRunning}><I.filter size={15} />{exportRunning ? tr('Running…') : tr('Run')}</button>
          <span className="faint" style={{ fontSize: 11.5 }}>{tr('Feeds the Custom Export section below')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-6)' }}>
        <InvoiceAgingReport />
        <ApprovalSlaReport periodDays={periodDays} />
        <ApproverPerformanceReport periodDays={periodDays} />
        <DeclinedInvoicesReport periodDays={periodDays} />
        <PendingPaymentsReport />
        <CustomExportReport rows={exportRows} />
      </div>
    </div>
  );
}

function ReportCard({ title, sub, icon, loading, exportData, exportFilename, children }: {
  title: string; sub: string; icon: IconComponent; loading: boolean;
  exportData?: Record<string, unknown>[]; exportFilename?: string; children: React.ReactNode;
}) {
  const tr = useTr();
  const Ico = icon;
  return (
    <div className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={17} /></div>
          <div><div className="card-title">{title}</div><div className="card-sub">{sub}</div></div>
        </div>
        {exportData && exportFilename && <ExportButtons data={exportData} filename={exportFilename} />}
      </div>
      <div className="card-pad">
        {loading ? <div className="empty"><I.reports size={28} /><div style={{ marginTop: 8 }}>{tr('Loading…')}</div></div> : children}
      </div>
    </div>
  );
}

export function ExportButtons({ data, filename }: { data: Record<string, unknown>[]; filename: string }) {
  const tr = useTr();
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn" onClick={() => downloadXlsx(`${filename}.xlsx`, data)}><I.download size={15} />{tr('Excel')}</button>
      <button className="btn" onClick={() => downloadCsv(`${filename}.csv`, data)}><I.download size={15} />{tr('CSV')}</button>
    </div>
  );
}

/** Single-series vertical column chart, direct-labelled (never color
 * alone) — used for Approval SLA / Approver Performance / Invoice Aging.
 * Plain flexbox columns (not SVG) so it genuinely fills the available card
 * width — each bar is a flex:1 track, dividing whatever space exists evenly
 * — down to a minimum readable width, below which it scrolls horizontally
 * instead of squeezing columns unreadably thin. One hue per report; only
 * Invoice Aging varies opacity across bars to encode ordinal severity (not
 * yet due → 90+ days), since that's a real status progression, not an
 * arbitrary categorical split. */
function ColumnChart({ items, valueFmt = (v: number) => String(v) }: {
  items: { label: string; value: number; displayValue: string; color: string }[];
  valueFmt?: (v: number) => string;
}) {
  const max = Math.max(...items.map(i => i.value), 1);
  const TRACK_H = 160;
  const gridFracs = [1, 0.75, 0.5, 0.25, 0];
  const MIN_COL_W = 76;

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px 14px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: items.length * MIN_COL_W }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: TRACK_H, paddingRight: 10, flexShrink: 0 }}>
          {gridFracs.map(f => (
            <span key={f} className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1 }}>{valueFmt(max * f)}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flex: 1, gap: 10 }}>
          {items.map(item => {
            // A genuine 0 renders as no visible bar at all — a forced
            // minimum height previously drew a confusing little sliver that
            // looked like a rendering glitch for zero-value categories.
            const pct = item.value > 0 ? Math.max(1.5, (item.value / max) * 100) : 0;
            return (
              <div key={item.label} style={{ flex: 1, minWidth: MIN_COL_W - 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--mono)', marginBottom: 6, whiteSpace: 'nowrap' }}>{item.displayValue}</div>
                <div style={{ height: TRACK_H, width: '100%', display: 'flex', alignItems: 'flex-end', borderLeft: '1px solid var(--border)', position: 'relative' }}>
                  {gridFracs.slice(1).map(f => (
                    <div key={f} style={{ position: 'absolute', left: 0, right: 0, bottom: `${f * 100}%`, height: 1, background: 'var(--border)' }} />
                  ))}
                  {pct > 0 && (
                    <div title={`${item.label} — ${item.displayValue}`} style={{
                      width: '70%', margin: '0 auto', height: `${pct}%`, minHeight: 4,
                      background: item.color, borderRadius: '6px 6px 0 0',
                      transition: 'height .5s cubic-bezier(.22,1,.36,1)',
                    }} />
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, textAlign: 'center', lineHeight: 1.3 }}>{item.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Hand-rolled SVG line chart (no charting dependency in this codebase) —
 * a grey panel with gridlines, a gradient-filled area under a smooth line,
 * and per-point hover tooltips (native <title>, so no extra JS state).
 * Used wherever a report has a genuine time series (declines over time),
 * not the point-in-time aggregates the bar reports show. */
function TrendLineChart({ points, color = 'var(--accent)', valueFmt = (v: number) => String(v) }: {
  points: { label: string; value: number; detail?: string }[];
  color?: string;
  valueFmt?: (v: number) => string;
}) {
  const gradId = useId().replace(/[:]/g, '');
  const W = 760, H = 220, PAD_L = 10, PAD_R = 10, PAD_T = 20, PAD_B = 30;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const max = Math.max(...points.map(p => p.value), 1);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    ...p,
    x: PAD_L + i * stepX,
    y: PAD_T + innerH - (p.value / max) * innerH,
  }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const baseline = PAD_T + innerH;
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${baseline} L ${coords[0].x.toFixed(1)} ${baseline} Z`
    : '';
  const gridFracs = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(coords.length / 7));

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 18px 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridFracs.map(f => {
          const y = PAD_T + innerH * f;
          return <line key={f} x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />;
        })}
        <text x={PAD_L} y={PAD_T - 6} fontSize="11" fill="var(--muted)" fontFamily="var(--mono)">{valueFmt(max)}</text>
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2}>
            <title>{c.label}{c.detail ? ` — ${c.detail}` : ''} — {valueFmt(c.value)}</title>
          </circle>
        ))}
        {coords.filter((_, i) => i % labelEvery === 0 || i === coords.length - 1).map((c, i) => (
          <text key={i} x={c.x} y={H - 8} fontSize="10.5" fill="var(--muted)" textAnchor={i === 0 ? 'start' : 'middle'}>{c.label}</text>
        ))}
      </svg>
    </div>
  );
}

function fmtHours(h: number): string {
  return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`;
}

// ---------- T143: Invoice Aging ----------
function InvoiceAgingReport() {
  const tr = useTr();
  const [data, setData] = useState<AgingBucket[] | null>(null);
  useEffect(() => { getInvoiceAging().then(setData); }, []);

  // Ordinal severity ramp on a single reserved status hue per side: green
  // (not yet due) → amber → red, deepening with age. Validated adjacent-pair
  // separation for the app's tone tokens: see the fixed categorical order
  // used elsewhere on this page (accent, teal, amber, violet, green, red).
  const severityColor = (label: string): string => {
    if (label.startsWith('Not yet due')) return 'var(--green)';
    if (label.startsWith('0-30')) return 'var(--amber)';
    if (label.startsWith('31-60')) return 'color-mix(in oklch, var(--amber), var(--red) 40%)';
    if (label.startsWith('61-90')) return 'color-mix(in oklch, var(--red), transparent 15%)';
    return 'var(--red)';
  };

  const totalOutstanding = data?.reduce((s, b) => s + b.total, 0) ?? 0;
  const totalCount = data?.reduce((s, b) => s + b.count, 0) ?? 0;
  const overdueTotal = data?.filter(b => !b.label.startsWith('Not yet due')).reduce((s, b) => s + b.total, 0) ?? 0;
  const chartItems = data?.map(b => ({ label: b.label, value: b.total, displayValue: fmtMoney(b.total), color: severityColor(b.label) })) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
      {data && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--gap-4)' }}>
          <MiniStat label={tr('Outstanding invoices')} value={totalCount} tone="blue" />
          <MiniStat label={tr('Total outstanding')} value={fmtMoney(totalOutstanding)} tone="violet" />
          <MiniStat label={tr('Overdue value')} value={fmtMoney(overdueTotal)} sub={tr('past due date')} tone="red" />
        </div>
      )}
      <ReportCard title={tr('Invoice Aging')} sub={tr('Outstanding invoices by days-since-due')} icon={I.calendar} loading={!data}
        exportData={data?.map(b => ({ bucket: b.label, count: b.count, total: b.total }))} exportFilename="invoice-aging">
        {data && (
          data.every(b => b.count === 0) ? <div className="faint" style={{ fontSize: 13 }}>{tr('No outstanding invoices.')}</div> : (
            <>
              <ColumnChart items={chartItems} valueFmt={fmtMoney} />
              <table className="tbl" style={{ marginTop: 22 }}>
                <thead><tr><th>{tr('Bucket')}</th><th className="right">{tr('Invoices')}</th><th className="right">{tr('Total outstanding')}</th></tr></thead>
                <tbody>
                  {data.map(b => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="right num">{b.count}</td>
                      <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )
        )}
      </ReportCard>
    </div>
  );
}

// ---------- T144: Approval SLA ----------
function ApprovalSlaReport({ periodDays }: { periodDays: number | null }) {
  const tr = useTr();
  const [data, setData] = useState<SlaRow[] | null>(null);
  useEffect(() => {
    const since = periodDays ? new Date(Date.now() - periodDays * 86_400_000).toISOString() : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    getApprovalSLA(since).then(setData);
  }, [periodDays]);

  return (
    <ReportCard title={tr('Approval SLA')} sub={tr('Average time spent at each workflow task')} icon={I.clock} loading={!data}
      exportData={data?.map(r => ({ task: r.taskName, avg_hours: r.avgHours.toFixed(1), decisions: r.count }))} exportFilename="approval-sla">
      {data && (
        data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No completed task transitions yet.')}</div> : (
          <>
            <ColumnChart items={data.map(r => ({ label: r.taskName, value: r.avgHours, displayValue: fmtHours(r.avgHours), color: 'var(--accent)' }))} valueFmt={fmtHours} />
            <table className="tbl" style={{ marginTop: 22 }}>
              <thead><tr><th>{tr('Task')}</th><th className="right">{tr('Avg. time at task')}</th><th className="right">{tr('Decisions')}</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.taskName}>
                    <td>{r.taskName}</td>
                    <td className="right num" style={{ fontWeight: 600 }}>{fmtHours(r.avgHours)}</td>
                    <td className="right num">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </ReportCard>
  );
}

// ---------- T145: Approver Performance ----------
function ApproverPerformanceReport({ periodDays }: { periodDays: number | null }) {
  const tr = useTr();
  const [data, setData] = useState<ApproverPerformanceRow[] | null>(null);
  useEffect(() => {
    const since = periodDays ? new Date(Date.now() - periodDays * 86_400_000).toISOString() : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    getApproverPerformance(since).then(setData);
  }, [periodDays]);

  return (
    <ReportCard title={tr('Approver Performance')} sub={tr('Volume and turnaround per approver')} icon={I.users} loading={!data}
      exportData={data?.map(r => ({ approver: r.actorName, actions: r.actions, avg_turnaround_hours: r.avgTurnaroundHours?.toFixed(1) ?? '' }))} exportFilename="approver-performance">
      {data && (
        data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No workflow actions recorded yet.')}</div> : (
          <>
            <ColumnChart items={data.map(r => ({ label: r.actorName, value: r.actions, displayValue: String(r.actions), color: 'var(--teal)' }))} valueFmt={(v) => String(Math.round(v))} />
            <table className="tbl" style={{ marginTop: 22 }}>
              <thead><tr><th>{tr('Approver')}</th><th className="right">{tr('Actions')}</th><th className="right">{tr('Avg. turnaround')}</th></tr></thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.actorName}>
                    <td style={{ fontWeight: 500 }}>{r.actorName}</td>
                    <td className="right num">{r.actions}</td>
                    <td className="right num">{r.avgTurnaroundHours == null ? '—' : fmtHours(r.avgTurnaroundHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )
      )}
    </ReportCard>
  );
}

// ---------- T146: Declined Invoices trend ----------
function DeclinedInvoicesReport({ periodDays }: { periodDays: number | null }) {
  const tr = useTr();
  const [data, setData] = useState<DeclinedRow[] | null>(null);
  useEffect(() => {
    const since = periodDays ? new Date(Date.now() - periodDays * 86_400_000).toISOString() : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    getDeclinedTrend(since).then(setData);
  }, [periodDays]);
  const totalValue = data?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const { page, setPage, totalPages, pageItems, total: totalRows, pageSize } = usePagination(data ?? []);

  // Buckets declines into calendar weeks (Mon–Sun) so the trend line stays
  // readable regardless of how much history is in `data` — last 12 weeks
  // that actually contain a decline, oldest first.
  const weeklyTrend = useMemo(() => {
    if (!data || data.length === 0) return [];
    const byWeek = new Map<string, { weekStart: Date; count: number; amount: number }>();
    for (const r of data) {
      const d = new Date(r.when);
      const sinceMonday = (d.getDay() + 6) % 7;
      const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
      const key = weekStart.toISOString().slice(0, 10);
      const entry = byWeek.get(key) ?? { weekStart, count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += r.amount;
      byWeek.set(key, entry);
    }
    return Array.from(byWeek.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
      .slice(-12)
      .map(w => ({ label: fmtDate(w.weekStart), value: w.count, detail: fmtMoney(w.amount) }));
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
      {data && data.length > 0 && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)' }}>
          <MiniStat label={tr('Declined invoices')} value={data.length} tone="red" />
          <MiniStat label={tr('Total value declined')} value={fmtMoney(totalValue)} tone="red" />
        </div>
      )}
      <ReportCard title={tr('Declined Invoices')} sub={tr('Every decline, with the task and reason recorded')} icon={I.x} loading={!data}
        exportData={data?.map(r => ({ invoice: r.code, vendor: r.vendor, amount: r.amount, task: r.taskName, reason: r.reason, when: r.when }))} exportFilename="declined-invoices">
        {data && (
          data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No declined invoices yet.')}</div> : (
            <>
              {weeklyTrend.length > 1 && (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 11 }}>{tr('Declines per week')}</div>
                  <TrendLineChart points={weeklyTrend} color="var(--red)" valueFmt={(v) => String(Math.round(v))} />
                </div>
              )}
              <table className="tbl">
                <thead><tr><th>{tr('Invoice')}</th><th>{tr('Vendor')}</th><th className="right">{tr('Amount')}</th><th>{tr('Task')}</th><th>{tr('Reason')}</th><th>{tr('When')}</th></tr></thead>
                <tbody>
                  {pageItems.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.code}</td>
                      <td>{r.vendor}</td>
                      <td className="right num">{fmtMoney(r.amount)}</td>
                      <td><Badge tone="red">{r.taskName}</Badge></td>
                      <td className="faint" style={{ fontStyle: r.reason ? 'italic' : 'normal' }}>{r.reason || '—'}</td>
                      <td className="faint">{fmtDate(new Date(r.when))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} total={totalRows} pageSize={pageSize} />
            </>
          )
        )}
      </ReportCard>
    </div>
  );
}

// ---------- T147: Pending Payments ----------
function PendingPaymentsReport() {
  const tr = useTr();
  const [data, setData] = useState<InvoiceRow[] | null>(null);
  useEffect(() => { getPendingPayments().then(setData); }, []);
  const total = data?.reduce((s, r) => s + r.total, 0) ?? 0;
  const { page, setPage, totalPages, pageItems, total: totalRows, pageSize } = usePagination(data ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
      {data && data.length > 0 && (
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)' }}>
          <MiniStat label={tr('Invoices pending payment')} value={data.length} tone="violet" />
          <MiniStat label={tr('Total awaiting the next run')} value={fmtMoney(total)} tone="violet" />
        </div>
      )}
      <ReportCard title={tr('Pending Payments')} sub={tr('Invoices approved and held for the next payment run')} icon={I.building} loading={!data}
        exportData={data?.map(r => ({ invoice: r.code, vendor: r.vendor, amount: r.total, due: r.due_at }))} exportFilename="pending-payments">
        {data && (
          data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No invoices pending payment.')}</div> : (
            <>
              <table className="tbl">
                <thead><tr><th>{tr('Invoice')}</th><th>{tr('Vendor')}</th><th className="right">{tr('Amount')}</th><th>{tr('Due')}</th></tr></thead>
                <tbody>
                  {pageItems.map(r => (
                    <tr key={r.id}>
                      <td className="mono">{r.code}</td>
                      <td>{r.vendor}</td>
                      <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(r.total)}</td>
                      <td className="faint">{fmtDate(new Date(r.due_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} total={totalRows} pageSize={pageSize} />
            </>
          )
        )}
      </ReportCard>
    </div>
  );
}

// ---------- T148: Custom filter export ----------
// Filter inputs (vendor/status) and the Run button live in ReportsView's
// top filter bar, alongside Period — this section just shows the results
// of the last run, lets you choose which fields to include, and exports.
function CustomExportReport({ rows }: { rows: InvoiceRow[] | null }) {
  const tr = useTr();
  const [fields, setFields] = useState<Record<string, boolean>>({ code: true, vendor: true, total: true, status: true, due_at: true });

  const allFields: (keyof InvoiceRow)[] = ['code', 'vendor', 'invoice_no', 'po', 'total', 'status', 'received_at', 'due_at', 'dept', 'company_code', 'stock_type'];

  return (
    <div className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent-strong)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><I.filter size={17} /></div>
          <div><div className="card-title">{tr('Custom Filter Export')}</div><div className="card-sub">{tr('Filter invoices, choose fields, export')}</div></div>
        </div>
      </div>
      <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {rows === null && <div className="faint" style={{ fontSize: 13 }}>{tr('Set your filters above and click Run to preview results here.')}</div>}

        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: 10 }}>{tr('Fields to include')}</div>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            {allFields.map(f => (
              <label key={f} className="row" style={{
                gap: 6, fontSize: 12.5, padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: fields[f] ? 'var(--accent-softer)' : 'var(--surface)',
                cursor: 'pointer',
              }}>
                <input type="checkbox" checked={!!fields[f]} onChange={e => setFields(v => ({ ...v, [f]: e.target.checked }))} />
                {f}
              </label>
            ))}
          </div>
        </div>

        {rows && (
          <div className="row" style={{ justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
            <span className="muted" style={{ fontSize: 13 }}><span className="mono" style={{ fontWeight: 600 }}>{rows.length}</span> {tr('invoices match')}</span>
            <ExportButtons filename="invoices-export" data={rows.map(r => {
              const out: Record<string, unknown> = {};
              allFields.filter(f => fields[f]).forEach(f => { out[f] = r[f]; });
              return out;
            })} />
          </div>
        )}
      </div>
    </div>
  );
}
