'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { Badge, Segmented, BarChart, LineChart, Donut, PageHeader } from '@/components/ui';
import { DASHBOARD, VENDOR_SPEND } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';

// =================== REPORTS ===================
export function ReportsView() {
  const toast = useToast();
  const [range_, setRange] = useState('30d');
  const d = DASHBOARD;
  const vendorSpend = VENDOR_SPEND;
  const reports = [
    { name: 'AP Aging Report', desc: 'Outstanding invoices by age bucket', icon: I.clock, updated: '2h ago' },
    { name: 'Vendor Spend Analysis', desc: 'Spend by vendor & category', icon: I.building, updated: '1d ago' },
    { name: 'Approval Cycle Time', desc: 'Time-to-approve by department', icon: I.approve, updated: '4h ago' },
    { name: 'Exception Summary', desc: 'Validation failures & resolution', icon: I.alert, updated: '6h ago' },
    { name: 'Tax & VAT Report', desc: 'VAT reclaim & compliance', icon: I.invoice, updated: '1d ago' },
    { name: 'Capture Throughput', desc: 'Volume & OCR accuracy by channel', icon: I.capture, updated: '30m ago' },
  ];

  return (
    <div className="view-enter">
      <PageHeader title="Reports & Analytics" sub="Operational insight across capture, processing, and approvals."
        actions={<>
          <Segmented options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'qtr', label: 'Quarter' }]} value={range_} onChange={(v) => setRange(String(v))} />
          <button className="btn primary" onClick={() => toast('Report exported to XLSX')}><I.download size={16} />Export</button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-5)', marginBottom: 'var(--gap-5)' }}>
        <div className="card">
          <div className="card-head">
            <div><div className="card-title">Spend by vendor</div><div className="card-sub">Top 7 · €000s</div></div>
            <Badge tone="blue">€2.4M total</Badge>
          </div>
          <div className="card-pad"><BarChart data={vendorSpend} height={200} valueFmt={(v) => `€${v}k`} /></div>
        </div>
        <div className="card">
          <div className="card-head">
            <div><div className="card-title">Avg. approval cycle time</div><div className="card-sub">Days · trending down</div></div>
            <Badge tone="green" dot>-22%</Badge>
          </div>
          <div className="card-pad">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 30, fontWeight: 600 }}>1.8</span>
              <span className="muted">days avg</span>
            </div>
            <LineChart data={d.cycleTrend} height={140} color="var(--green)" />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <span className="faint" style={{ fontSize: 11 }}>Jun 2025</span>
              <span className="faint" style={{ fontSize: 11 }}>May 2026</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--gap-5)', marginBottom: 'var(--gap-5)' }}>
        <div className="card">
          <div className="card-head"><div className="card-title">Processing status</div></div>
          <div className="card-pad" style={{ display: 'grid', placeItems: 'center', paddingTop: 24, paddingBottom: 24 }}>
            <Donut data={d.statusMix} size={160} thickness={26} />
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div><div className="card-title">Monthly invoice volume vs. spend</div><div className="card-sub">12-month trend</div></div>
          </div>
          <div className="card-pad">
            <LineChart data={d.spendTrend} height={200} color="var(--accent)" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="card-title">Saved reports</div><button className="btn ghost sm"><I.plus size={14} />New report</button></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
          {reports.map((r, i) => {
            const Ico = r.icon;
            return (
              <button key={r.name} onClick={() => toast(`Opening "${r.name}"…`)}
                style={{
                  display: 'flex', gap: 13, padding: 18, border: 'none', background: 'none', textAlign: 'left',
                  borderRight: (i % 3 !== 2) ? '1px solid var(--border)' : 'none',
                  borderBottom: i < 3 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.desc}</div>
                  <div className="faint" style={{ fontSize: 11, marginTop: 7 }}>Updated {r.updated}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
