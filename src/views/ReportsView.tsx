'use client';

import { useEffect, useState } from 'react';
import { I, type IconComponent } from '@/components/icons';
import { Badge, MiniStat, PageHeader, Pagination, usePagination } from '@/components/ui';
import { fmtMoney, cx } from '@/lib/utils';
import { fmtDate } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { downloadXlsx } from '@/lib/xlsx';
import { useTr } from '@/lib/i18n';
import {
  getInvoiceAging, getApprovalSLA, getApproverPerformance, getDeclinedTrend, getPendingPayments, exportInvoices,
  type AgingBucket, type SlaRow, type ApproverPerformanceRow, type DeclinedRow, type InvoiceExportFilters,
} from '@/lib/server/reports';
import type { InvoiceRow } from '@/lib/supabase/types';

const TABS: { key: string; label: string; icon: IconComponent }[] = [
  { key: 'Invoice Aging', label: 'Invoice Aging', icon: I.calendar },
  { key: 'Approval SLA', label: 'Approval SLA', icon: I.clock },
  { key: 'Approver Performance', label: 'Approver Performance', icon: I.users },
  { key: 'Declined Invoices', label: 'Declined Invoices', icon: I.x },
  { key: 'Pending Payments', label: 'Pending Payments', icon: I.building },
  { key: 'Custom Export', label: 'Custom Export', icon: I.filter },
];
type Tab = typeof TABS[number]['key'];

// =================== REPORTS — SOW §5.6 ===================
export function ReportsView() {
  const tr = useTr();
  const [tab, setTab] = useState<Tab>('Invoice Aging');

  return (
    <div className="view-enter">
      <PageHeader title={tr('Reports & Analytics')} sub={tr('The six SOW §5.6 reports — Invoice Aging, Approval SLA, Approver Performance, Declined Invoices, Pending Payments, and a custom filter export.')} />

      <div className="tabs" style={{ marginBottom: 'var(--gap-5)' }}>
        {TABS.map(t => {
          const Ico = t.icon;
          return (
            <button key={t.key} className={cx('tab', tab === t.key && 'on')} onClick={() => setTab(t.key)}>
              <span className="row" style={{ gap: 7, display: 'inline-flex', alignItems: 'center' }}><Ico size={14} />{tr(t.label)}</span>
            </button>
          );
        })}
      </div>

      {tab === 'Invoice Aging' && <InvoiceAgingReport />}
      {tab === 'Approval SLA' && <ApprovalSlaReport />}
      {tab === 'Approver Performance' && <ApproverPerformanceReport />}
      {tab === 'Declined Invoices' && <DeclinedInvoicesReport />}
      {tab === 'Pending Payments' && <PendingPaymentsReport />}
      {tab === 'Custom Export' && <CustomExportReport />}
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

/** Single-series ranked horizontal bars, direct-labelled (never color alone)
 * — used for Approval SLA / Approver Performance / Invoice Aging. One hue
 * per report; only Invoice Aging varies opacity across bars to encode
 * ordinal severity (not yet due → 90+ days), since that's a real status
 * progression, not an arbitrary categorical split. */
function RankedBars({ items }: { items: { label: string; value: number; displayValue: string; color: string }[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 168, fontSize: 12.5, color: 'var(--text-2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.label}>{item.label}</div>
          <div style={{ flex: 1, height: 20, background: 'var(--surface-2)', borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${Math.max(2, (item.value / max) * 100)}%`, background: item.color, borderRadius: 5, transition: 'width .5s cubic-bezier(.22,1,.36,1)' }} />
          </div>
          <div className="mono" style={{ width: 76, textAlign: 'right', fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{item.displayValue}</div>
        </div>
      ))}
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
              <RankedBars items={data.map(b => ({ label: b.label, value: b.total, displayValue: fmtMoney(b.total), color: severityColor(b.label) }))} />
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
function ApprovalSlaReport() {
  const tr = useTr();
  const [data, setData] = useState<SlaRow[] | null>(null);
  useEffect(() => { getApprovalSLA().then(setData); }, []);

  return (
    <ReportCard title={tr('Approval SLA')} sub={tr('Average time spent at each workflow task')} icon={I.clock} loading={!data}
      exportData={data?.map(r => ({ task: r.taskName, avg_hours: r.avgHours.toFixed(1), decisions: r.count }))} exportFilename="approval-sla">
      {data && (
        data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No completed task transitions yet.')}</div> : (
          <>
            <RankedBars items={data.map(r => ({ label: r.taskName, value: r.avgHours, displayValue: fmtHours(r.avgHours), color: 'var(--accent)' }))} />
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
function ApproverPerformanceReport() {
  const tr = useTr();
  const [data, setData] = useState<ApproverPerformanceRow[] | null>(null);
  useEffect(() => { getApproverPerformance().then(setData); }, []);

  return (
    <ReportCard title={tr('Approver Performance')} sub={tr('Volume and turnaround per approver')} icon={I.users} loading={!data}
      exportData={data?.map(r => ({ approver: r.actorName, actions: r.actions, avg_turnaround_hours: r.avgTurnaroundHours?.toFixed(1) ?? '' }))} exportFilename="approver-performance">
      {data && (
        data.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>{tr('No workflow actions recorded yet.')}</div> : (
          <>
            <RankedBars items={data.map(r => ({ label: r.actorName, value: r.actions, displayValue: String(r.actions), color: 'var(--teal)' }))} />
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
function DeclinedInvoicesReport() {
  const tr = useTr();
  const [data, setData] = useState<DeclinedRow[] | null>(null);
  useEffect(() => { getDeclinedTrend().then(setData); }, []);
  const totalValue = data?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const { page, setPage, totalPages, pageItems, total: totalRows, pageSize } = usePagination(data ?? []);

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
function CustomExportReport() {
  const tr = useTr();
  const [filters, setFilters] = useState<InvoiceExportFilters>({});
  const [rows, setRows] = useState<InvoiceRow[] | null>(null);
  const [fields, setFields] = useState<Record<string, boolean>>({ code: true, vendor: true, total: true, status: true, due_at: true });
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setRows(await exportInvoices(filters));
    setRunning(false);
  }

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
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder={tr('Vendor contains…')} style={{ maxWidth: 220 }}
            value={filters.vendor ?? ''} onChange={e => setFilters(f => ({ ...f, vendor: e.target.value || undefined }))} />
          <select className="input" style={{ maxWidth: 200 }} value={filters.status ?? ''} onChange={e => setFilters(f => ({ ...f, status: e.target.value || undefined }))}>
            <option value="">{tr('Any status')}</option>
            {['Awaiting Approval', 'In Review', 'Approved', 'Paid', 'Exception', 'Processing', 'Pending Payment', 'At AcDep', 'Order not placed via PD', 'Paid Invoice', 'Declined'].map(s => <option key={s} value={s}>{tr(s)}</option>)}
          </select>
          <button className="btn primary" onClick={run} disabled={running}><I.filter size={15} />{running ? tr('Running…') : tr('Run')}</button>
        </div>

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
