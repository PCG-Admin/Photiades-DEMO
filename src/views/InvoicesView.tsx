'use client';

/* Invoice Processing — hero module */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { I } from '@/components/icons';
import { Badge, StatusBadge, Checkbox, Segmented, PageHeader, MiniStat } from '@/components/ui';
import { FF, ReadField } from '@/components/form-fields';
import { ApprovalChain } from '@/components/ApprovalChain';
import { cx, fmtMoney } from '@/lib/utils';
import { INVOICES, fmtDate, fmtDateShort, relTime, genChain, type Invoice } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';

interface ExtractedField {
  key: string;
  label: string;
  value: string;
  conf: number;
}

export function InvoicesView({ initialId = null }: { initialId?: string | null }) {
  const toast = useToast();

  // seed some invoices with workflow-outcome statuses for the new lists
  const seeded = useMemo(() => INVOICES.map((inv, i) => {
    if (i % 7 === 2) return { ...inv, status: 'Pending Payment' };
    if (i % 7 === 4) return { ...inv, status: 'At AcDep' };
    if (i % 11 === 5) return { ...inv, status: 'Order not placed via PD' };
    if (inv.status === 'Paid') return { ...inv, status: 'Paid Invoice' };
    return inv;
  }), []);
  const [invoices, setInvoices] = useState<Invoice[]>(seeded);
  const [selected, setSelected] = useState<Invoice | null>(initialId ? (seeded.find(i => i.id === initialId) ?? null) : null);
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | number>('received');

  // Open the deep-linked invoice when the ?id= search param changes (the page
  // is not remounted across same-route searchParam changes).
  useEffect(() => {
    if (initialId) {
      const f = seeded.find(i => i.id === initialId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (f) setSelected(f);
    }
  }, [initialId, seeded]);

  const tabs = ['All', 'Awaiting Approval', 'In Review', 'Exception', 'At AcDep', 'Pend. Pmt', 'Orders not placed by PD', 'Paid Invoice'];
  const tabStatus: Record<string, string> = { 'Pend. Pmt': 'Pending Payment', 'Orders not placed by PD': 'Order not placed via PD' };
  const statusFor = (t: string) => tabStatus[t] || t;
  const tabCount = (t: string) => t === 'All' ? invoices.length : invoices.filter(i => i.status === statusFor(t)).length;

  let filtered = invoices.filter(i => tab === 'All' || i.status === statusFor(tab));
  if (q) filtered = filtered.filter(i => (i.vendor + i.id + (i.po || '')).toLowerCase().includes(q.toLowerCase()));
  filtered = [...filtered].sort((a, b) => sortBy === 'amount' ? b.total - a.total : b.received.getTime() - a.received.getTime());

  function decide(inv: Invoice, action: string) {
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : 'In Review' } : i));
    setSelected(null);
    toast(action === 'approve' ? `${inv.id} approved & routed for payment` : action === 'reject' ? `${inv.id} rejected — returned to clerk` : `${inv.id} placed on hold`);
  }

  if (selected) {
    return <InvoiceDetail inv={selected} onBack={() => setSelected(null)} onDecide={decide} toast={toast} />;
  }

  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map(i => i.id)));
  };

  return (
    <div className="view-enter">
      <PageHeader title="Invoice Processing"
        sub="Review extracted data, resolve exceptions, and route invoices for approval."
        actions={<>
          <button className="btn"><I.download size={16} />Export</button>
          <button className="btn primary"><I.plus size={16} />New invoice</button>
        </>}
      />

      {/* summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Total outstanding" value={fmtMoney(invoices.filter(i => !['Paid Invoice'].includes(i.status)).reduce((s, i) => s + i.total, 0))} tone="blue" />
        <MiniStat label="At AcDep" value={tabCount('At AcDep')} sub="in accounts" tone="amber" />
        <MiniStat label="Pending payment" value={tabCount('Pend. Pmt')} sub="awaiting run" tone="violet" />
        <MiniStat label="Paid invoices" value={tabCount('Paid Invoice')} sub="settled" tone="green" />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '0 var(--gap-5)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="tabs" style={{ border: 'none' }}>
            {tabs.map(t => (
              <button key={t} className={cx('tab', tab === t && 'on')} onClick={() => setTab(t)}>
                {t} <span className="mono" style={{ fontSize: 11, opacity: 0.65 }}>{tabCount(t)}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px var(--gap-5)', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="search" style={{ width: 280, padding: '6px 12px' }}>
            <I.search size={15} />
            <input placeholder="Search vendor, invoice or PO…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn sm"><I.filter size={14} />Filters</button>
          <div className="spacer" />
          {checked.size > 0 ? (
            <div className="row" style={{ gap: 8, animation: 'fadeIn 0.15s' }}>
              <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>{checked.size} selected</span>
              <button className="btn sm success"><I.check size={14} />Approve</button>
              <button className="btn sm danger"><I.x size={14} />Reject</button>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>Sort</span>
              <Segmented options={[{ value: 'received', label: 'Recent' }, { value: 'amount', label: 'Amount' }]} value={sortBy} onChange={setSortBy} />
            </div>
          )}
        </div>

        <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}><Checkbox checked={checked.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th>Invoice</th><th>Vendor</th><th>PO match</th><th className="right">Amount</th>
                <th style={{ width: 130 }}>Confidence</th><th>Status</th><th>Due</th><th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className={cx('clickable', checked.has(inv.id) && 'selected')} onClick={() => setSelected(inv)}>
                  <td onClick={e => e.stopPropagation()}>
                    <Checkbox checked={checked.has(inv.id)} onChange={(v) => {
                      const n = new Set(checked); if (v) n.add(inv.id); else n.delete(inv.id); setChecked(n);
                    }} />
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)' }}>{inv.id}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{inv.po || 'No PO'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.vendor}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{inv.dept}</div>
                  </td>
                  <td>
                    {inv.poMatch === 'Matched' ? <Badge tone="green" dot>Matched</Badge> :
                      <Badge tone="red" dot>{inv.poMatch}</Badge>}
                  </td>
                  <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(inv.total)}</td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="progress" style={{ flex: 1, maxWidth: 60 }}>
                        <span style={{ width: `${inv.confidence}%`, background: inv.confidence >= 90 ? 'var(--green)' : inv.confidence >= 75 ? 'var(--amber)' : 'var(--red)' }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{inv.confidence}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>
                    <span className="num" style={{ fontSize: 12.5, color: inv.dueOverdue ? 'var(--red)' : 'var(--text-2)', fontWeight: inv.dueOverdue ? 600 : 400 }}>
                      {fmtDateShort(inv.due)}
                    </span>
                    {inv.dueOverdue && <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>Overdue</div>}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button className="icon-btn" style={{ width: 28, height: 28 }}><I.dots size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><I.invoice size={32} /><div style={{ marginTop: 10 }}>No invoices match your filters</div></div>}
        </div>
      </div>
    </div>
  );
}

type ShowToast = ReturnType<typeof useToast>;

// =================== INVOICE DETAIL (extraction + validation) ===================
function InvoiceDetail({ inv, onBack, onDecide, toast }: {
  inv: Invoice;
  onBack: () => void;
  onDecide: (inv: Invoice, action: string) => void;
  toast: ShowToast;
}) {
  const [hoverField, setHoverField] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const hasExceptions = inv.flags && inv.flags.length > 0;

  const extractedFields: ExtractedField[] = [
    { key: 'vendor', label: 'Vendor name', value: inv.vendor, conf: inv.extractedConf.vendor },
    { key: 'invoiceNo', label: 'Invoice number', value: inv.invoiceNo, conf: inv.extractedConf.invoiceNo },
    { key: 'date', label: 'Invoice date', value: fmtDate(inv.received), conf: inv.extractedConf.date },
    { key: 'due', label: 'Due date', value: fmtDate(inv.due), conf: inv.extractedConf.due },
    { key: 'po', label: 'PO reference', value: inv.po || '—', conf: inv.extractedConf.po },
    { key: 'subtotal', label: 'Subtotal', value: fmtMoney(inv.subtotal), conf: inv.extractedConf.subtotal },
    { key: 'vat', label: 'VAT (19%)', value: fmtMoney(inv.vat), conf: inv.extractedConf.vat },
    { key: 'total', label: 'Total due', value: fmtMoney(inv.total), conf: inv.confidence },
  ];

  return (
    <div className="view-enter">
      {/* header bar */}
      <div className="row" style={{ gap: 14, marginBottom: 'var(--gap-5)', flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />Back</button>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }} className="mono">{inv.id}</h2>
            <StatusBadge status={inv.status} />
            {inv.priority && <Badge tone="violet">{inv.priority}</Badge>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{inv.vendor} · received {relTime(inv.received)} via email</div>
        </div>
        <div className="spacer" />
        <button className="btn"><I.history size={15} />History</button>
        <button className="btn"><I.download size={15} />Download</button>
      </div>

      {hasExceptions && (
        <div className="card" style={{ borderColor: 'color-mix(in oklch, var(--red), transparent 60%)', background: 'var(--red-soft)', marginBottom: 'var(--gap-5)', padding: '14px 18px' }}>
          <div className="row" style={{ gap: 10, color: 'var(--red)' }}>
            <I.alert size={18} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{inv.flags.length} validation {inv.flags.length === 1 ? 'exception' : 'exceptions'} detected</span>
          </div>
          <ul style={{ margin: '10px 0 0', paddingLeft: 28, fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {inv.flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr', gap: 'var(--gap-5)', alignItems: 'start' }}>
        {/* LEFT: document preview with overlays */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'sticky', top: 0 }}>
          <div className="card-head">
            <div className="card-title">Source document</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost sm"><I.eye size={14} />OCR overlay</button>
              <Badge tone="gray">Page 1 / 1</Badge>
            </div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto', padding: 24, background: 'var(--surface-2)' }}>
            <DocFacsimile inv={inv} hoverField={hoverField} />
          </div>
        </div>

        {/* RIGHT: extraction + validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
          {/* PO matching */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">3-way PO match</div>
              {inv.poMatch === 'Matched' ? <Badge tone="green" dot>Matched</Badge> : <Badge tone="red" dot>{inv.poMatch}</Badge>}
            </div>
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <MatchCell label="Purchase order" value={inv.po || 'Not found'} ok={!!inv.po} amount={inv.po ? fmtMoney(inv.subtotal + (inv.poMatch === 'Mismatch' ? 420 : 0)) : '—'} />
              <MatchCell label="Goods receipt" value={inv.po ? inv.grn : '—'} ok={!!inv.po} amount={inv.po ? fmtMoney(inv.subtotal) : '—'} />
              <MatchCell label="Invoice" value={inv.invoiceNo} ok={inv.poMatch === 'Matched'} amount={fmtMoney(inv.subtotal)} highlight />
            </div>
          </div>

          {/* Invoice indexing / storage form */}
          <InvoiceForm key={inv.id} inv={inv} extractedFields={extractedFields} hoverField={hoverField} setHoverField={setHoverField} toast={toast} />

          {/* Line items */}
          <div className="card">
            <div className="card-head"><div className="card-title">Line items</div><Badge tone="gray">{inv.lineItems.length} lines</Badge></div>
            <table className="tbl">
              <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Amount</th><th>GL</th></tr></thead>
              <tbody>
                {inv.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 12.5 }}>{li.desc}</td>
                    <td className="right num" style={{ fontSize: 12.5 }}>{li.qty}</td>
                    <td className="right num" style={{ fontSize: 12.5 }}>{fmtMoney(li.unit)}</td>
                    <td className="right num" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtMoney(li.amount)}</td>
                    <td className="mono faint" style={{ fontSize: 11.5 }}>{li.gl}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={3} style={{ fontWeight: 600, fontSize: 12.5 }}>Subtotal · VAT 19% · Total</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{fmtMoney(inv.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Approval chain */}
          <div className="card">
            <div className="card-head"><div className="card-title">Approval routing</div></div>
            <div className="card-pad">
              <ApprovalChain steps={genChain(inv.status === 'Approved' || inv.status === 'Paid' ? 3 : 1)} amount={inv.total} />
            </div>
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="card" style={{ marginTop: 'var(--gap-5)', padding: 'var(--gap-4) var(--gap-5)', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', bottom: 0 }}>
        <input className="input" placeholder="Add a comment for the next approver…" value={comment} onChange={e => setComment(e.target.value)} style={{ flex: 1 }} />
        <button className="btn" onClick={() => onDecide(inv, 'hold')}><I.clock size={15} />Hold</button>
        <button className="btn danger" onClick={() => onDecide(inv, 'reject')}><I.x size={15} />Reject</button>
        <button className="btn success" onClick={() => onDecide(inv, 'approve')}><I.check size={15} />Approve & route</button>
      </div>
    </div>
  );
}

// Invoice indexing / storage form — canonical fields used to store an invoice
const COMPANY_CODES = ['1000', '2000', '3000', '4000'];
const STOCK_TYPES = ['Stock', 'Non-stock', 'Stock & Non Stock'];
const SAP_POSTING_TYPES = ['Invoice', 'Credit Note', 'Subsequent Debit', 'Subsequent Credit'];

function hashSeed(s: string) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; }
function toISO(d: Date) { return new Date(d).toISOString().slice(0, 10); }

function InvoiceForm({ inv, extractedFields, hoverField, setHoverField, toast }: {
  inv: Invoice;
  extractedFields: ExtractedField[];
  hoverField: string | null;
  setHoverField: (v: string | null) => void;
  toast: ShowToast;
}) {
  const conf = useMemo<Record<string, number>>(() => Object.fromEntries(extractedFields.map(f => [f.key, f.conf])), [extractedFields]);
  const xmlStatus = ['Approved', 'Paid'].includes(inv.status) ? 'Exported' : inv.status === 'Exception' ? 'Failed' : 'Pending';
  const xmlTone = xmlStatus === 'Exported' ? 'green' : xmlStatus === 'Failed' ? 'red' : 'amber';

  const init = useMemo(() => {
    const h = hashSeed(inv.id);
    const stockType = STOCK_TYPES[h % 3];
    return {
      date: toISO(inv.received),
      dueDate: toISO(inv.due),
      vendor: inv.vendor,
      amount: inv.total,
      po: inv.po || '',
      companyCode: COMPANY_CODES[h % COMPANY_CODES.length],
      invoiceNumber: inv.invoiceNo,
      vendorRef: `VR-${10000 + (h % 89999)}`,
      sapPostingType: h % 9 === 0 ? 'Credit Note' : 'Invoice',
      stockType,
      stockDocNumber: stockType !== 'Non-stock' ? `MIGO-49${String(h % 10000).padStart(4, '0')}` : '',
      nonStockDocNumber: stockType !== 'Stock' ? `SES-51${String(h % 100000).padStart(5, '0')}` : '',
    };
  }, [inv.id, inv.received, inv.due, inv.vendor, inv.total, inv.po, inv.invoiceNo]);

  // Reset is handled by remount (key={inv.id} at the call site).
  const [form, setForm] = useState(init);
  const [dirty, setDirty] = useState(false);
  const set = (k: string, v: string | number) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Invoice details</div>
          <div className="card-sub">Fields stored on submit · hover to locate on document</div>
        </div>
        {dirty
          ? <button className="btn primary sm" onClick={() => { toast('Invoice details saved'); setDirty(false); }}><I.check size={14} />Save</button>
          : <Badge tone={inv.confidence >= 90 ? 'green' : 'amber'}>{inv.confidence}% extracted</Badge>}
      </div>

      {/* Read-only document meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid var(--border)' }}>
        <ReadField label="Document Type" value="Invoice" />
        <ReadField label="Status" value={inv.status} statusTone />
        <ReadField label="XML Status" value={xmlStatus} dot={`var(--${xmlTone})`} noBorder />
      </div>

      {/* Editable indexing fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', padding: 'var(--gap-5)' }}>
        <FF label="Date" conf={conf.date} hk="date" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
        </FF>
        <FF label="Due Date" conf={conf.due} hk="due" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="date" className="input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </FF>

        <FF label="Vendor" conf={conf.vendor} hk="vendor" hoverField={hoverField} setHoverField={setHoverField} span2>
          <input type="text" className="input" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
        </FF>

        <FF label="Amount" conf={conf.total} hk="total" hoverField={hoverField} setHoverField={setHoverField}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>€</span>
            <input type="text" inputMode="decimal" className="input mono" style={{ paddingLeft: 24, textAlign: 'right' }}
              value={Number(form.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => set('amount', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)} />
          </div>
        </FF>
        <FF label="Invoice Number" conf={conf.invoiceNo} hk="invoiceNo" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} />
        </FF>

        <FF label="Purchase Order Number" conf={conf.po} hk="po" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" placeholder="No PO" value={form.po} onChange={e => set('po', e.target.value)} />
        </FF>
        <FF label="Company Code" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" value={form.companyCode} onChange={e => set('companyCode', e.target.value)} />
        </FF>

        <FF label="Vendor Reference" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" value={form.vendorRef} onChange={e => set('vendorRef', e.target.value)} />
        </FF>
        <FF label="SAP Posting Type" hoverField={hoverField} setHoverField={setHoverField}>
          <select className="input" value={form.sapPostingType} onChange={e => set('sapPostingType', e.target.value)}>
            {SAP_POSTING_TYPES.map(o => <option key={o}>{o}</option>)}
          </select>
        </FF>

        <FF label="Stock / Non Stock" hoverField={hoverField} setHoverField={setHoverField} span2>
          <select className="input" value={form.stockType} onChange={e => set('stockType', e.target.value)}>
            {STOCK_TYPES.map(o => <option key={o}>{o}</option>)}
          </select>
        </FF>

        {form.stockType !== 'Non-stock' && (
          <FF label="Stock Document Number" hoverField={hoverField} setHoverField={setHoverField} span2={form.stockType !== 'Stock & Non Stock'}>
            <input type="text" className="input mono" placeholder="e.g. MIGO-490000" value={form.stockDocNumber} onChange={e => set('stockDocNumber', e.target.value)} />
          </FF>
        )}
        {form.stockType !== 'Stock' && (
          <FF label="Non-Stock Document Number" hoverField={hoverField} setHoverField={setHoverField} span2={form.stockType !== 'Stock & Non Stock'}>
            <input type="text" className="input mono" placeholder="e.g. SES-5100023891" value={form.nonStockDocNumber} onChange={e => set('nonStockDocNumber', e.target.value)} />
          </FF>
        )}
      </div>
    </div>
  );
}

function MatchCell({ label, value, amount, ok, highlight }: {
  label: string;
  value: string;
  amount: string;
  ok: boolean;
  highlight?: boolean;
}) {
  return (
    <div style={{ padding: 12, borderRadius: 8, background: highlight ? 'var(--accent-softer)' : 'var(--surface-2)', border: `1px solid ${ok ? 'var(--border)' : 'color-mix(in oklch, var(--red), transparent 60%)'}` }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>{label}</span>
        {ok ? <I.check size={14} style={{ color: 'var(--green)' }} stroke={3} /> : <I.alert size={13} style={{ color: 'var(--red)' }} />}
      </div>
      <div className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
      <div className="num" style={{ fontSize: 13, marginTop: 4, color: ok ? 'var(--text)' : 'var(--red)', fontWeight: 600 }}>{amount}</div>
    </div>
  );
}

// Document facsimile (invoice rendering)
function DocFacsimile({ inv, hoverField }: {
  inv: Invoice;
  hoverField: string | null;
}) {
  const hl = (key: string): React.CSSProperties => hoverField === key ? { background: 'var(--accent-ring)', outline: '2px solid var(--accent)', borderRadius: 3, transition: 'all 0.12s' } : { transition: 'all 0.12s' };
  return (
    <div style={{ background: 'white', color: '#1a1a1a', maxWidth: 560, margin: '0 auto', padding: '40px 44px', borderRadius: 4, boxShadow: 'var(--shadow)', fontSize: 12, minHeight: 600 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ width: 120, height: 34, background: '#eee', borderRadius: 3, display: 'grid', placeItems: 'center', color: '#999', fontSize: 10, fontFamily: 'var(--mono)' }}>VENDOR LOGO</div>
          <div style={{ marginTop: 12, fontWeight: 700, fontSize: 14, ...hl('vendor'), display: 'inline-block', padding: '1px 3px' }}>{inv.vendor}</div>
          <div style={{ color: '#777', marginTop: 4, lineHeight: 1.6, fontSize: 11 }}>
            {inv.facsimile.street} Arch. Makarios Ave<br />{inv.facsimile.city} {inv.facsimile.postcode}, Cyprus<br />VAT: CY{inv.facsimile.vatNo}X
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 300, letterSpacing: '0.1em', color: '#333' }}>INVOICE</div>
          <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.9 }}>
            <div><span style={{ color: '#999' }}>No: </span><span style={{ fontWeight: 600, ...hl('invoiceNo'), padding: '1px 3px' }}>{inv.invoiceNo}</span></div>
            <div><span style={{ color: '#999' }}>Date: </span><span style={{ ...hl('date'), padding: '1px 3px' }}>{fmtDate(inv.received)}</span></div>
            <div><span style={{ color: '#999' }}>Due: </span><span style={{ ...hl('due'), padding: '1px 3px' }}>{fmtDate(inv.due)}</span></div>
            {inv.po && <div><span style={{ color: '#999' }}>PO: </span><span style={{ ...hl('po'), padding: '1px 3px' }}>{inv.po}</span></div>}
          </div>
        </div>
      </div>
      <div style={{ background: '#f6f6f6', padding: '10px 14px', borderRadius: 3, marginBottom: 20, fontSize: 11 }}>
        <span style={{ color: '#999' }}>Bill to: </span>Photiades Group Ltd · Finance Dept · {inv.dept}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ddd', color: '#999', textAlign: 'left' }}>
            <th style={{ padding: '7px 4px', fontWeight: 600 }}>DESCRIPTION</th>
            <th style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 600 }}>QTY</th>
            <th style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 600 }}>UNIT</th>
            <th style={{ padding: '7px 4px', textAlign: 'right', fontWeight: 600 }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {inv.lineItems.map((li, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px 4px' }}>{li.desc}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{li.qty}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{li.unit.toFixed(2)}</td>
              <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{li.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <div style={{ width: 220, fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 4px' }}>
            <span style={{ color: '#777' }}>Subtotal</span>
            <span style={{ fontFamily: 'var(--mono)', ...hl('subtotal'), padding: '1px 3px' }}>{fmtMoney(inv.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 4px' }}>
            <span style={{ color: '#777' }}>VAT 19%</span>
            <span style={{ fontFamily: 'var(--mono)', ...hl('vat'), padding: '1px 3px' }}>{fmtMoney(inv.vat)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderTop: '2px solid #333', marginTop: 4, fontWeight: 700, fontSize: 13 }}>
            <span>TOTAL</span>
            <span style={{ fontFamily: 'var(--mono)', ...hl('total'), padding: '1px 3px' }}>{fmtMoney(inv.total)}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #eee', color: '#aaa', fontSize: 10, textAlign: 'center' }}>
        Payment terms: Net 30 · IBAN CY{inv.facsimile.ibanA} {inv.facsimile.ibanB} {inv.facsimile.ibanC} · Thank you for your business
      </div>
    </div>
  );
}
