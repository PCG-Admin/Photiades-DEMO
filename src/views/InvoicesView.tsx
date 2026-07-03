'use client';

/* Invoice Processing — hero module */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { I } from '@/components/icons';
import { Badge, StatusBadge, Checkbox, Segmented, PageHeader, MiniStat, Modal } from '@/components/ui';
import { FF, ReadField } from '@/components/form-fields';
import { ApprovalChain } from '@/components/ApprovalChain';
import { DocumentHighlightPreview } from '@/components/DocumentHighlightPreview';
import { cx, fmtMoney } from '@/lib/utils';
import { fmtDateShort } from '@/lib/format';
import { RelativeTime } from '@/components/RelativeTime';
import { STOCK_TYPES } from '@/lib/constants';
import { useToast } from '@/components/providers/ToastProvider';
import { useGo } from '@/lib/navigation';
import { getInvoiceByCode, updateInvoiceFields, deleteInvoice, type InvoiceWithLineItems } from '@/lib/server/invoices';
import { getWorkflowInstanceForInvoice, type WorkflowInstanceWithHistory } from '@/lib/server/workflows';
import { getAuditEvents } from '@/lib/server/audit';
import type { InvoiceRow, AuditEventRow } from '@/lib/supabase/types';
import { errorMessage } from '@/lib/errorMessage';

const isOverdue = (inv: InvoiceRow) => new Date(inv.due_at) < new Date() && !['Paid', 'Paid Invoice', 'Approved'].includes(inv.status);

export function InvoicesView({ initialInvoices, initialId = null }: { initialInvoices: InvoiceRow[]; initialId?: string | null }) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [selectedCode, setSelectedCode] = useState<string | null>(initialId);
  const [tab, setTab] = useState('All');
  const [q, setQ] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string | number>('received');

  // Re-open the deep-linked invoice when the ?id= search param changes (the
  // page is not remounted across same-route searchParam changes).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCode(initialId);
  }, [initialId]);

  function saveInvoice(updated: InvoiceRow) {
    setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
  }

  function removeInvoice(id: string) {
    setInvoices(prev => prev.filter(i => i.id !== id));
    setSelectedCode(null);
  }

  const tabs = ['All', 'Awaiting Approval', 'In Review', 'Exception', 'At AcDep', 'Pend. Pmt', 'Orders not placed by PD', 'Paid Invoice'];
  const tabStatus: Record<string, string> = { 'Pend. Pmt': 'Pending Payment', 'Orders not placed by PD': 'Order not placed via PD' };
  const statusFor = (t: string) => tabStatus[t] || t;
  const tabCount = (t: string) => t === 'All' ? invoices.length : invoices.filter(i => i.status === statusFor(t)).length;

  let filtered = invoices.filter(i => tab === 'All' || i.status === statusFor(tab));
  if (q) filtered = filtered.filter(i => (i.vendor + i.code + (i.po || '')).toLowerCase().includes(q.toLowerCase()));
  filtered = [...filtered].sort((a, b) => sortBy === 'amount' ? b.total - a.total : new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

  if (selectedCode) {
    return <InvoiceDetail code={selectedCode} onBack={() => setSelectedCode(null)} onSave={saveInvoice} onDelete={removeInvoice} />;
  }

  const toggleAll = () => {
    if (checked.size === filtered.length) setChecked(new Set());
    else setChecked(new Set(filtered.map(i => i.id)));
  };

  return (
    <div className="view-enter">
      <PageHeader title="Invoice Processing"
        sub="Review extracted data, resolve exceptions, and route invoices for approval."
        actions={<button className="btn"><I.download size={16} />Export</button>}
      />

      {/* summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Total outstanding" value={fmtMoney(invoices.filter(i => !['Paid Invoice', 'Paid'].includes(i.status)).reduce((s, i) => s + i.total, 0))} tone="blue" />
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
          <div className="spacer" />
          {checked.size > 0 ? (
            <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>{checked.size} selected</span>
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
                <th style={{ width: 130 }}>Confidence</th><th>Status</th><th>Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className={cx('clickable', checked.has(inv.id) && 'selected')} onClick={() => setSelectedCode(inv.code)}>
                  <td onClick={e => e.stopPropagation()}>
                    <Checkbox checked={checked.has(inv.id)} onChange={(v) => {
                      const n = new Set(checked); if (v) n.add(inv.id); else n.delete(inv.id); setChecked(n);
                    }} />
                  </td>
                  <td>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)' }}>{inv.code}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{inv.po || 'No PO'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.vendor}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{inv.dept}</div>
                  </td>
                  <td>
                    {inv.po_match == null ? <Badge tone="gray">Not checked</Badge> :
                      inv.po_match === 'Matched' ? <Badge tone="green" dot>Matched</Badge> : <Badge tone="red" dot>{inv.po_match}</Badge>}
                  </td>
                  <td className="right num" style={{ fontWeight: 600 }}>{fmtMoney(inv.total)}</td>
                  <td>
                    {inv.confidence == null ? <span className="faint" style={{ fontSize: 12 }}>—</span> : (
                      <div className="row" style={{ gap: 8 }}>
                        <div className="progress" style={{ flex: 1, maxWidth: 60 }}>
                          <span style={{ width: `${inv.confidence}%`, background: inv.confidence >= 90 ? 'var(--green)' : inv.confidence >= 75 ? 'var(--amber)' : 'var(--red)' }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{inv.confidence}%</span>
                      </div>
                    )}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>
                    <span className="num" style={{ fontSize: 12.5, color: isOverdue(inv) ? 'var(--red)' : 'var(--text-2)', fontWeight: isOverdue(inv) ? 600 : 400 }}>
                      {fmtDateShort(new Date(inv.due_at))}
                    </span>
                    {isOverdue(inv) && <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600 }}>Overdue</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty"><I.invoice size={32} /><div style={{ marginTop: 10 }}>{invoices.length === 0 ? 'No invoices captured yet' : 'No invoices match your filters'}</div></div>}
        </div>
      </div>
    </div>
  );
}

// =================== INVOICE DETAIL (extraction + validation) ===================
function InvoiceDetail({ code, onBack, onSave, onDelete }: {
  code: string;
  onBack: () => void;
  onSave: (updated: InvoiceRow) => void;
  onDelete: (id: string) => void;
}) {
  const toast = useToast();
  const go = useGo();
  const [hoverField, setHoverField] = useState<string | null>(null);
  const [inv, setInv] = useState<InvoiceWithLineItems | null>(null);
  const [instance, setInstance] = useState<WorkflowInstanceWithHistory | null>(null);
  const [history, setHistory] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      const full = await getInvoiceByCode(code);
      if (cancelled || !full) return;
      setInv(full);
      const [wf, events] = await Promise.all([
        getWorkflowInstanceForInvoice(full.id),
        getAuditEvents({ invoiceId: full.id }),
      ]);
      if (cancelled) return;
      setInstance(wf);
      setHistory(events);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (loading || !inv) {
    return (
      <div className="view-enter">
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />Back</button>
        <div className="empty" style={{ marginTop: 40 }}><I.invoice size={32} /><div style={{ marginTop: 10 }}>Loading invoice…</div></div>
      </div>
    );
  }

  const hasExceptions = inv.flags.length > 0;
  const chainSteps = instance ? instance.history.map(h => ({
    role: h.actor_name, name: h.task_name, action: h.action_label, when: new Date(h.occurred_at),
  })) : [];

  function handleSave(updated: InvoiceRow) {
    setInv(prev => prev ? { ...prev, ...updated } : prev);
    onSave(updated);
    if (instance) go('workflows', instance.code);
  }

  async function handleDelete() {
    if (!inv) return;
    setDeleting(true);
    try {
      await deleteInvoice(inv.id);
      toast(`${inv.code} deleted`);
      onDelete(inv.id);
    } catch (err) {
      toast(`Delete failed: ${errorMessage(err)}`);
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="view-enter">
      {/* header bar */}
      <div className="row" style={{ gap: 14, marginBottom: 'var(--gap-5)', flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={onBack}><I.chevL size={16} />Back</button>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600 }} className="mono">{inv.code}</h2>
            <StatusBadge status={inv.status} />
            {inv.priority && <Badge tone="violet">{inv.priority}</Badge>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{inv.vendor} · received <RelativeTime date={new Date(inv.received_at)} /></div>
        </div>
        <div className="spacer" />
        <button className="btn danger sm" onClick={() => setConfirmingDelete(true)}><I.trash size={15} />Delete</button>
      </div>

      {confirmingDelete && (
        <Modal title="Delete this invoice?" sub={`${inv.code} — ${inv.vendor}`} onClose={() => setConfirmingDelete(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmingDelete(false)} disabled={deleting}>Cancel</button>
            <button className="btn danger" onClick={handleDelete} disabled={deleting}><I.trash size={15} />{deleting ? 'Deleting…' : 'Delete invoice'}</button>
          </>}>
          <div className="row" style={{ gap: 10, color: 'var(--red)', alignItems: 'flex-start' }}>
            <I.alert size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              This permanently deletes the invoice, its line items, and its workflow history. It cannot be undone.
            </span>
          </div>
        </Modal>
      )}

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
        {/* LEFT: the document uploaded at capture time, if any */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="card-head"><div className="card-title">Source document</div></div>
          <div style={{ maxHeight: 'calc(100vh - 230px)', overflowY: 'auto', padding: 24, background: 'var(--surface-2)' }}>
            {inv.documentUrl ? (
              <DocumentHighlightPreview url={inv.documentUrl} mimeType={inv.document_mime_type} fileName={inv.code} />
            ) : (
              <div className="empty" style={{ padding: '60px 24px' }}>
                <I.doc size={32} />
                <div style={{ marginTop: 10 }}>No stored document</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>This invoice was captured before document storage was added</div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: extraction + validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
          {/* Invoice indexing / storage form */}
          <InvoiceForm key={inv.id} inv={inv} hoverField={hoverField} setHoverField={setHoverField} onSave={handleSave} toast={toast} />

          {/* Line items */}
          <div className="card">
            <div className="card-head"><div className="card-title">Line items</div><Badge tone="gray">{inv.lineItems.length} lines</Badge></div>
            <table className="tbl">
              <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Unit</th><th className="right">Amount</th><th>GL</th></tr></thead>
              <tbody>
                {inv.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td style={{ fontSize: 12.5 }}>{li.description}</td>
                    <td className="right num" style={{ fontSize: 12.5 }}>{li.qty}</td>
                    <td className="right num" style={{ fontSize: 12.5 }}>{fmtMoney(li.unit_price)}</td>
                    <td className="right num" style={{ fontSize: 12.5, fontWeight: 600 }}>{fmtMoney(li.amount)}</td>
                    <td className="mono faint" style={{ fontSize: 11.5 }}>{li.gl_code}</td>
                  </tr>
                ))}
                {inv.lineItems.length === 0 && <tr><td colSpan={5} className="faint" style={{ fontSize: 12.5, padding: 12 }}>No line items captured</td></tr>}
                <tr style={{ background: 'var(--surface-2)' }}>
                  <td colSpan={3} style={{ fontWeight: 600, fontSize: 12.5 }}>Subtotal · VAT · Total</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{fmtMoney(inv.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Approval chain (workflow history) */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Workflow routing</div>
              {instance && <Badge tone="blue">{instance.wf_id === 'stock' ? 'Stock' : 'Non-Stock'} workflow</Badge>}
            </div>
            <div className="card-pad">
              {!instance ? (
                <span className="faint" style={{ fontSize: 13 }}>No workflow started for this invoice.</span>
              ) : chainSteps.length === 0 ? (
                <span className="faint" style={{ fontSize: 13 }}>Awaiting the first task decision.</span>
              ) : (
                <ApprovalChain steps={chainSteps} amount={inv.total} />
              )}
            </div>
          </div>

          {/* Immutable audit log for this invoice — SOW §5.7 (T149) */}
          <div className="card">
            <div className="card-head"><div className="card-title">History</div><Badge tone="gray">{history.length}</Badge></div>
            <div style={{ padding: '8px 0' }}>
              {history.length === 0 && <div className="faint" style={{ fontSize: 12.5, padding: '8px 20px' }}>No recorded actions yet</div>}
              {history.map(e => (
                <div key={e.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{e.actor_name}</span>
                    <span className="muted"> {e.action}</span>
                  </div>
                  <div className="row" style={{ gap: 8, marginTop: 3 }}>
                    <span className="faint" style={{ fontSize: 11.5 }}><RelativeTime date={new Date(e.occurred_at)} /></span>
                    {e.changes && e.changes.length > 0 && (
                      <span className="faint mono" style={{ fontSize: 11 }}>
                        {e.changes.map(c => `${c.field}: ${String(c.before ?? '—')} → ${String(c.after ?? '—')}`).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ShowToast = ReturnType<typeof useToast>;

// Invoice indexing / storage form — the canonical field set from SOW §5.2
function toISO(iso: string) { return iso.slice(0, 10); }

// Plausible non-stock service-entry document numbers to offer in the dropdown,
// per SOW §5.2 (Non-Stock Document Number: Dropdown).
function nonStockDocOptions(current: string) {
  const opts = new Set(['', 'SES-5100023891', 'SES-5100031204', 'SES-5100048822']);
  if (current) opts.add(current);
  return Array.from(opts);
}

function InvoiceForm({ inv, hoverField, setHoverField, onSave, toast }: {
  inv: InvoiceRow;
  hoverField: string | null;
  setHoverField: (v: string | null) => void;
  onSave: (updated: InvoiceRow) => void;
  toast: ShowToast;
}) {
  const xmlTone = inv.xml_status === 'Exported' ? 'green' : inv.xml_status === 'Failed' ? 'red' : 'amber';

  const init = useMemo(() => ({
    date: toISO(inv.received_at),
    dueDate: toISO(inv.due_at),
    vendor: inv.vendor,
    amount: inv.total,
    po: inv.po || '',
    companyCode: inv.company_code,
    invoiceNumber: inv.invoice_no,
    vendorRef: inv.vendor_ref,
    stockType: inv.stock_type ?? '',
    stockDocNumber: inv.stock_doc_number ?? '',
    nonStockDocNumber: inv.non_stock_doc_number ?? '',
  }), [inv]);

  // Reset is handled by remount (key={inv.id} at the call site).
  const [form, setForm] = useState(init);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  async function save() {
    setSaving(true);
    try {
      const updated = await updateInvoiceFields(inv.id, {
        received_at: form.date,
        due_at: form.dueDate,
        vendor: form.vendor,
        total: Number(form.amount) || inv.total,
        po: form.po || null,
        company_code: form.companyCode,
        invoice_no: String(form.invoiceNumber),
        vendor_ref: form.vendorRef,
        stock_type: (form.stockType || null) as InvoiceRow['stock_type'],
        stock_doc_number: form.stockDocNumber || null,
        non_stock_doc_number: form.nonStockDocNumber || null,
      });
      onSave(updated);
      toast('Invoice details saved');
      setDirty(false);
    } catch (err) {
      toast(`Save failed: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Invoice details</div>
          <div className="card-sub">Fields stored on submit · hover to locate on document</div>
        </div>
        {dirty
          ? <button className="btn primary sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : <><I.check size={14} />Save</>}</button>
          : inv.confidence != null && <Badge tone={inv.confidence >= 90 ? 'green' : 'amber'}>{inv.confidence}% extracted</Badge>}
      </div>

      {/* Read-only document meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid var(--border)' }}>
        <ReadField label="Document Type" value="Invoice" />
        <ReadField label="Status" value={inv.status} statusTone />
        <ReadField label="XML Status" value={inv.xml_status} dot={`var(--${xmlTone})`} noBorder />
      </div>

      {/* Editable indexing fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', padding: 'var(--gap-5)' }}>
        <FF label="Date" hk="date" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} />
        </FF>
        <FF label="Due Date" hk="due" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="date" className="input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </FF>

        <FF label="Vendor" hk="vendor" hoverField={hoverField} setHoverField={setHoverField} span2>
          <input type="text" className="input" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
        </FF>

        <FF label="Amount" hk="total" hoverField={hoverField} setHoverField={setHoverField}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>€</span>
            <input type="text" inputMode="decimal" className="input mono" style={{ paddingLeft: 24, textAlign: 'right' }}
              value={Number(form.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => set('amount', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)} />
          </div>
        </FF>
        <FF label="Invoice Number" hk="invoiceNo" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} />
        </FF>

        <FF label="Purchase Order Number" hk="po" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" placeholder="No PO" value={form.po} onChange={e => set('po', e.target.value)} />
        </FF>
        <FF label="Company Code" hoverField={hoverField} setHoverField={setHoverField}>
          <input type="text" className="input mono" value={form.companyCode} onChange={e => set('companyCode', e.target.value)} />
        </FF>

        <FF label="Vendor Reference" hoverField={hoverField} setHoverField={setHoverField} span2>
          <input type="text" className="input mono" value={form.vendorRef} onChange={e => set('vendorRef', e.target.value)} />
        </FF>

        <FF label="Stock / Non Stock" hoverField={hoverField} setHoverField={setHoverField} span2>
          <select className="input" value={form.stockType} onChange={e => set('stockType', e.target.value)}>
            <option value="">— Unclassified —</option>
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
            <select className="input mono" value={form.nonStockDocNumber} onChange={e => set('nonStockDocNumber', e.target.value)}>
              {nonStockDocOptions(form.nonStockDocNumber).map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </FF>
        )}
      </div>
    </div>
  );
}
