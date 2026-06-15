'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { I } from '@/components/icons';
import { StatusBadge, PageHeader } from '@/components/ui';
import { FF, ReadField } from '@/components/form-fields';
import { DOCUMENTS, DOC_TYPES, VENDORS, range, pick, rnd, daysAgo, type DocumentRecord } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';

type ShowToast = ReturnType<typeof useToast>;

// =================== DOCUMENT CAPTURE ===================
export function CaptureView() {
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentRecord[]>(DOCUMENTS);
  const [drag, setDrag] = useState(false);
  const [selectedId, setSelectedId] = useState(DOCUMENTS[0].id);

  // animate in-progress docs
  useEffect(() => {
    const t = setInterval(() => {
      setDocs(prev => prev.map(d => {
        if (['Classifying', 'Extracting'].includes(d.status) && d.progress < 100) {
          const np = Math.min(100, d.progress + range(3, 11));
          if (np >= 100) {
            return { ...d, progress: 100, status: d.status === 'Classifying' ? 'Extracting' : 'Verified' };
          }
          return { ...d, progress: np };
        }
        return d;
      }));
    }, 1400);
    return () => clearInterval(t);
  }, []);

  const selected = docs.find(d => d.id === selectedId) || null;

  function simulateUpload() {
    const type = pick(DOC_TYPES);
    const nd: DocumentRecord = {
      id: `DOC-${range(90300, 90999)}`,
      name: `${type.toLowerCase().replace(' ', '_')}_${range(1000, 9999)}.pdf`,
      type, typeConf: range(88, 99), status: 'Classifying',
      source: 'Manual Upload', pages: range(1, 4), size: `${(rnd() * 2 + 0.3).toFixed(1)} MB`,
      received: daysAgo(0), progress: 8,
    };
    setDocs(prev => [nd, ...prev]);
    setSelectedId(nd.id);
    toast('Document uploaded — classification started');
  }

  return (
    <div className="view-enter">
      <PageHeader title="Document Capture"
        sub="Capture documents and index the fields needed to store them."
        actions={<>
          <button className="btn"><I.scan size={16} />Scan</button>
          <button className="btn primary" onClick={simulateUpload}><I.upload size={16} />Upload document</button>
        </>}
      />

      {/* Dropzone — full width */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); simulateUpload(); }}
        onClick={simulateUpload}
        className="card"
        style={{
          display: 'flex', alignItems: 'center', gap: 18,
          border: drag ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
          background: drag ? 'var(--accent-softer)' : 'var(--surface)',
          padding: '20px 24px', cursor: 'pointer', transition: 'all 0.15s', marginBottom: 'var(--gap-5)',
        }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <I.upload size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Drop files to capture</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>or click to browse · PDF, TIFF, JPG, PNG · auto-classification &amp; OCR on ingest</div>
        </div>
        <button className="btn primary" onClick={(e) => { e.stopPropagation(); simulateUpload(); }}><I.plus size={15} />Add file</button>
      </div>

      {/* Index fields — full width */}
      {selected
        ? <CaptureIndexForm doc={selected} toast={toast} key={selected.id} />
        : <div className="card" style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>
            <div className="empty"><I.doc size={34} /><div style={{ marginTop: 10, fontWeight: 500 }}>Upload a document to index</div></div>
          </div>}
    </div>
  );
}

// Indexing field picklists
const CAP_COMPANY_CODES = ['1000', '2000', '3000', '4000'];
const CAP_STOCK_TYPES = ['Stock', 'Non-stock', 'Stock & Non Stock'];
const CAP_SAP_TYPES = ['Invoice', 'Credit Note', 'Subsequent Debit', 'Subsequent Credit'];
const capHash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000; return h; };
const capISO = (d: Date | string, addDays = 0) => { const x = new Date(d); x.setDate(x.getDate() + addDays); return x.toISOString().slice(0, 10); };

// Rule 3 — Date validation: reject dates more than N months older than today
const MAX_DATE_AGE_MONTHS = 4;
const TODAY_ISO = capISO(daysAgo(0));
function dateTooOld(iso: string) {
  if (!iso) return false;
  const floor = new Date(daysAgo(0));
  floor.setMonth(floor.getMonth() - MAX_DATE_AGE_MONTHS);
  return new Date(iso) < floor;
}
function dateFloorISO() {
  const floor = new Date(daysAgo(0));
  floor.setMonth(floor.getMonth() - MAX_DATE_AGE_MONTHS);
  return floor.toISOString().slice(0, 10);
}

function CaptureIndexForm({ doc, toast }: { doc: DocumentRecord; toast: ShowToast }) {
  const xmlStatus = doc.status === 'Verified' ? 'Ready' : doc.status === 'Exception' ? 'Failed' : 'Pending';
  const xmlTone = xmlStatus === 'Ready' ? 'green' : xmlStatus === 'Failed' ? 'red' : 'amber';

  const init = useMemo(() => {
    const h = capHash(doc.id);
    const stockType = CAP_STOCK_TYPES[h % 3];
    return {
      date: capISO(doc.received),
      dueDate: capISO(doc.received, 30),
      vendor: VENDORS[h % VENDORS.length],
      amount: 500 + (h % 45000) + 0.5,
      po: `PO-${40000 + (h % 9999)}`,
      companyCode: CAP_COMPANY_CODES[h % CAP_COMPANY_CODES.length],
      invoiceNumber: `${['A', 'INV', 'F', 'R'][h % 4]}${10000 + (h % 89999)}`,
      vendorRef: `VR-${10000 + (h % 89999)}`,
      sapPostingType: h % 9 === 0 ? 'Credit Note' : 'Invoice',
      sapInvText: '',
      stockType,
      stockDocNumber: stockType !== 'Non-stock' ? `MIGO-49${String(h % 10000).padStart(4, '0')}` : '',
      nonStockDocNumber: stockType !== 'Stock' ? `SES-51${String(h % 100000).padStart(5, '0')}` : '',
    };
  }, [doc.id, doc.received]);

  // Reset is handled by remount (key={selected.id} at the call site).
  const [form, setForm] = useState(init);
  const [dirty, setDirty] = useState(false);
  const set = (k: keyof typeof init, v: string | number) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const dateInvalid = dateTooOld(form.date);
  const canSave = !dateInvalid;

  function handleSave() {
    if (!canSave) { toast(`Date cannot be more than ${MAX_DATE_AGE_MONTHS} months old`); return; }
    toast('Document indexed & stored'); setDirty(false);
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="row" style={{ gap: 12 }}>
          <div style={{ width: 30, height: 38, borderRadius: 5 }} className="doc-placeholder" />
          <div>
            <div className="card-title">Index document</div>
            <div className="mono faint" style={{ fontSize: 11.5, marginTop: 2 }}>{doc.name} · {doc.id}</div>
          </div>
        </div>
        {dirty
          ? <button className="btn primary sm" onClick={handleSave} disabled={!canSave}><I.check size={14} />Save &amp; store</button>
          : <StatusBadge status={doc.status} />}
      </div>

      {/* Read-only document meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid var(--border)' }}>
        <ReadField label="Document Type" value={doc.type} />
        <ReadField label="Status" value={doc.status} statusTone />
        <ReadField label="XML Status" value={xmlStatus} dot={`var(--${xmlTone})`} noBorder />
      </div>

      {/* Editable indexing fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px', padding: 'var(--gap-5)' }}>
        <FF label="Date">
          <input type="date" className="input" value={form.date} min={dateFloorISO()} max={TODAY_ISO}
            onChange={e => set('date', e.target.value)}
            style={dateInvalid ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px color-mix(in oklch, var(--red), transparent 78%)' } : {}} />
          {dateInvalid && (
            <div className="row" style={{ gap: 5, marginTop: 5, color: 'var(--red)', fontSize: 11 }}>
              <I.alert size={12} />Date is more than {MAX_DATE_AGE_MONTHS} months old — not accepted
            </div>
          )}
        </FF>
        <FF label="Due Date">
          <input type="date" className="input" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
        </FF>
        <FF label="Vendor" span2>
          <input type="text" className="input" value={form.vendor} onChange={e => set('vendor', e.target.value)} />
        </FF>
        <FF label="Amount">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)' }}>€</span>
            <input type="text" inputMode="decimal" className="input mono" style={{ paddingLeft: 24, textAlign: 'right' }}
              value={Number(form.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              onChange={e => set('amount', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)} />
          </div>
        </FF>
        <FF label="Invoice Number">
          <input type="text" className="input mono" value={form.invoiceNumber} onChange={e => set('invoiceNumber', e.target.value)} />
        </FF>
        <FF label="Purchase Order Number">
          <input type="text" className="input mono" placeholder="No PO" value={form.po} onChange={e => set('po', e.target.value)} />
        </FF>
        <FF label="Company Code">
          <input type="text" className="input mono" value={form.companyCode} onChange={e => set('companyCode', e.target.value)} />
        </FF>
        <FF label="Vendor Reference">
          <input type="text" className="input mono" value={form.vendorRef} onChange={e => set('vendorRef', e.target.value)} />
        </FF>
        <FF label="SAP Posting Type">
          <select className="input" value={form.sapPostingType} onChange={e => set('sapPostingType', e.target.value)}>
            {CAP_SAP_TYPES.map(o => <option key={o}>{o}</option>)}
          </select>
        </FF>
        <FF label="SAP Invoice Text" span2>
          <textarea className="input" rows={2} value={form.sapInvText} onChange={e => set('sapInvText', e.target.value)}
            placeholder="Text posted to SAP with the invoice…" style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
        </FF>
        <FF label="Stock / Non Stock" span2>
          <select className="input" value={form.stockType} onChange={e => set('stockType', e.target.value)}>
            {CAP_STOCK_TYPES.map(o => <option key={o}>{o}</option>)}
          </select>
        </FF>
        {form.stockType !== 'Non-stock' && (
          <FF label="Stock Document Number" span2={form.stockType !== 'Stock & Non Stock'}>
            <input type="text" className="input mono" placeholder="e.g. MIGO-490000" value={form.stockDocNumber} onChange={e => set('stockDocNumber', e.target.value)} />
          </FF>
        )}
        {form.stockType !== 'Stock' && (
          <FF label="Non-Stock Document Number" span2={form.stockType !== 'Stock & Non Stock'}>
            <input type="text" className="input mono" placeholder="e.g. SES-5100023891" value={form.nonStockDocNumber} onChange={e => set('nonStockDocNumber', e.target.value)} />
          </FF>
        )}
      </div>
    </div>
  );
}
