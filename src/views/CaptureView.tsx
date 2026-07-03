'use client';

/* Document Capture — "Store to Documents" workspace */
import * as React from 'react';
import { useRef, useState } from 'react';
import { I } from '@/components/icons';
import { Badge, PageHeader } from '@/components/ui';
import { cx } from '@/lib/utils';
import { daysAgo } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import { useGo } from '@/lib/navigation';
import { extractDocument } from '@/lib/server/extraction';
import { createInvoiceFromExtraction, findDuplicateInvoice, findDuplicateInvoiceByHash } from '@/lib/server/invoices';
import { DocumentHighlightPreview } from '@/components/DocumentHighlightPreview';
import { sha256Hex } from '@/lib/hash';
import { ACCEPTED_UPLOAD_TYPES, ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/lib/uploadConstraints';
import { COMPANY_CODES } from '@/lib/constants';
import type { ExtractedInvoice } from '@/lib/gemini/extract';
import type { InvoiceRow } from '@/lib/supabase/types';
import { errorMessage } from '@/lib/errorMessage';

// Indexing field picklists
const CAP_STOCK_TYPES = ['', 'Stock', 'Non-stock', 'Stock & Non Stock'];
const CAP_COMPANY_CODES = ['', ...COMPANY_CODES];
const CAP_SAP_TYPES = ['Invoice', 'Credit Note', 'Subsequent Debit', 'Subsequent Credit'];

// Rule 3 — Date validation: reject dates more than N months older than today
const MAX_DATE_AGE_MONTHS = 4;
const capISO2 = (d: Date | string, addDays = 0) => { const x = new Date(d); x.setDate(x.getDate() + addDays); return x.toISOString().slice(0, 10); };
const TODAY_ISO = capISO2(daysAgo(0));
function dateFloorISO() {
  const floor = new Date(daysAgo(0));
  floor.setMonth(floor.getMonth() - MAX_DATE_AGE_MONTHS);
  return floor.toISOString().slice(0, 10);
}
function dateTooOld(iso: string) {
  if (!iso) return false;
  return new Date(iso) < new Date(dateFloorISO());
}

interface CapForm {
  docType: string; status: string; xmlStatus: string;
  date: string; dueDate: string;
  vendor: string; amount: string | number;
  po: string; companyCode: string; invoiceNumber: string; vendorRef: string;
  sapPostingType: string; sapInvText: string;
  stockType: string; stockDocNumber: string; nonStockDocNumber: string;
}

const INITIAL_FORM: CapForm = {
  docType: 'Invoice', status: 'New', xmlStatus: 'New',
  date: '', dueDate: '',
  vendor: '',
  amount: '',
  po: '',
  companyCode: '',
  invoiceNumber: '',
  vendorRef: '',
  sapPostingType: 'Invoice',
  sapInvText: '',
  stockType: '',
  stockDocNumber: '',
  nonStockDocNumber: '',
};

/** Maps Gemini's extraction result (src/lib/gemini/extract.ts) onto the
 * capture indexing form's fields (SOW §5.1 auto-extract requirement). */
function formFromExtraction(extracted: ExtractedInvoice): CapForm {
  return {
    docType: 'Invoice', status: 'Extracted', xmlStatus: 'New',
    date: extracted.date ?? '',
    dueDate: extracted.dueDate ?? '',
    vendor: extracted.vendor,
    amount: extracted.total,
    po: extracted.po ?? '',
    // Company code is an internal SAP posting code, not something printed on
    // a vendor's invoice — Gemini can't read it off the document, so it's
    // never defaulted; only accept a value if it matches a real code and
    // require the reviewer to pick one otherwise (validated in store()).
    companyCode: extracted.companyCode && (COMPANY_CODES as string[]).includes(extracted.companyCode) ? extracted.companyCode : '',
    invoiceNumber: extracted.invoiceNo,
    vendorRef: extracted.vendorRef ?? '',
    sapPostingType: 'Invoice',
    sapInvText: '',
    stockType: extracted.stockType ?? '',
    stockDocNumber: '',
    nonStockDocNumber: '',
  };
}

interface MaterialRow { item: string; material: string }

// =================== DOCUMENT CAPTURE — "Store to Documents" ===================
export function CaptureView() {
  const toast = useToast();
  const go = useGo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<CapForm>(INITIAL_FORM);
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [lineItems, setLineItems] = useState<ExtractedInvoice['lineItems']>([]);
  const [boxes, setBoxes] = useState<ExtractedInvoice['boxes']>([]);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [storing, setStoring] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState<InvoiceRow | null>(null);
  const [duplicateReason, setDuplicateReason] = useState<'file' | 'invoice' | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [overrideDuplicate, setOverrideDuplicate] = useState(false);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const set = (k: keyof CapForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const dateInvalid = dateTooOld(form.date);

  function updateLineItem(i: number, patch: Partial<ExtractedInvoice['lineItems'][number]>) {
    setLineItems(items => items.map((it, j) => j === i ? { ...it, ...patch } : it));
  }
  function addLineItem() {
    setLineItems(items => [...items, { description: '', qty: 1, unitPrice: 0, amount: 0, glCode: null }]);
  }
  function removeLineItem(i: number) {
    setLineItems(items => items.filter((_, j) => j !== i));
  }

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setPreviewUrl(null); setConfidence(null); setExtractError(null);
    setDuplicateOf(null); setDuplicateReason(null); setOverrideDuplicate(false); setDocumentHash(null);
  }

  async function runExtraction(f: File) {
    setExtracting(true);
    setExtractError(null);
    setConfidence(null);

    const result = await extractDocument(f);
    setExtracting(false);
    if (result.ok) {
      setForm(formFromExtraction(result.data));
      setLineItems(result.data.lineItems);
      setBoxes(result.data.boxes);
      setConfidence(result.data.confidence);
      toast('Fields extracted — review before storing');
      // Secondary check: same vendor + invoice number, in case this is a
      // re-scan of the same invoice (different file bytes, so the hash
      // check below wouldn't have caught it).
      setCheckingDuplicate(true);
      const found = await findDuplicateInvoice(result.data.vendor, result.data.invoiceNo);
      setCheckingDuplicate(false);
      if (found) { setDuplicateOf(found); setDuplicateReason('invoice'); setOverrideDuplicate(false); }
    } else {
      setExtractError(result.error);
      toast(`Extraction failed: ${result.error}`);
    }
  }

  async function handleFile(f: File) {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    const typeOk = ACCEPTED_UPLOAD_TYPES.includes(f.type) || ACCEPTED_UPLOAD_EXTENSIONS.includes(ext);
    if (!typeOk) {
      toast(`Unsupported file type — upload a PDF, PNG, JPG, WEBP, or HEIC.`);
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      toast(`File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB) — max 15 MB.`);
      return;
    }

    setForm(INITIAL_FORM); setRows([]); setLineItems([]); setBoxes([]); setActiveField(null);
    setDuplicateOf(null); setDuplicateReason(null); setOverrideDuplicate(false);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setUploaded(true);

    // Exact-file check first — deterministic, and cheap enough to run
    // before spending a Gemini call on a document we already have.
    setCheckingDuplicate(true);
    const hash = await sha256Hex(await f.arrayBuffer());
    setDocumentHash(hash);
    const hashDupe = await findDuplicateInvoiceByHash(hash);
    setCheckingDuplicate(false);

    if (hashDupe) {
      setDuplicateOf(hashDupe);
      setDuplicateReason('file');
      toast(`This exact file is already stored as ${hashDupe.code}`);
      return;
    }
    await runExtraction(f);
  }
  async function store() {
    if (dateInvalid) { toast(`Date cannot be more than ${MAX_DATE_AGE_MONTHS} months old`); return; }
    if (!form.vendor.trim() || !form.invoiceNumber.trim() || !form.date || !form.companyCode) {
      toast('Vendor, Invoice Number, Date, and Company Code are required'); return;
    }
    if (duplicateOf && !overrideDuplicate) {
      toast(`Looks like a duplicate of ${duplicateOf.code} — confirm below to store anyway`); return;
    }
    setStoring(true);
    try {
      const invoice = await createInvoiceFromExtraction({
        vendor: form.vendor,
        invoiceNo: form.invoiceNumber,
        date: form.date,
        dueDate: form.dueDate,
        po: form.po || null,
        companyCode: form.companyCode,
        vendorRef: form.vendorRef,
        stockType: (form.stockType || null) as 'Stock' | 'Non-stock' | 'Stock & Non Stock' | null,
        amount: Number(form.amount) || 0,
        lineItems: lineItems.map(li => ({ description: li.description, qty: li.qty, unitPrice: li.unitPrice, amount: li.amount, glCode: li.glCode })),
        confidence,
        documentHash,
      }, file);
      toast(`Stored as ${invoice.code}`);
      clearFile();
      setUploaded(false);
      go('invoices', invoice.code);
    } catch (err) {
      toast(`Store failed: ${errorMessage(err)}`);
    } finally {
      setStoring(false);
    }
  }
  function reset() { setForm(INITIAL_FORM); setRows([]); toast('Form reset'); }
  function cancel() { clearFile(); setUploaded(false); }

  // Upload landing — the Store screen only appears once a document is uploaded
  if (!uploaded) {
    return (
      <div className="view-enter">
        <PageHeader title="Document Capture"
          sub="Upload a document to capture and index it into the portal."
          actions={<button className="btn primary" onClick={() => fileInputRef.current?.click()}><I.upload size={16} />Upload document</button>}
        />
        <input ref={fileInputRef} type="file" accept={[...ACCEPTED_UPLOAD_TYPES, ...ACCEPTED_UPLOAD_EXTENSIONS].join(',')} style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className="card"
          style={{
            border: drag ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
            background: drag ? 'var(--accent-softer)' : 'var(--surface)',
            padding: '64px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            minHeight: 'calc(100vh - 280px)', justifyContent: 'center',
          }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
            <I.upload size={32} />
          </div>
          <div style={{ fontWeight: 600, fontSize: 17 }}>Drop a document to capture</div>
          <div className="muted" style={{ fontSize: 13.5, maxWidth: 380, lineHeight: 1.5 }}>or click to browse · PDF, PNG, JPG, WEBP. Fields are auto-extracted and the Store form opens for review.</div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <button className="btn primary lg" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><I.upload size={16} />Upload document</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cap-wrap view-enter">
      {/* Toolbar */}
      <div className="cap-toolbar">
        <button className="cap-tbtn" onClick={cancel}><I.chevL size={15} />Cancel</button>
        <button className="cap-tbtn" onClick={reset}><I.refresh size={14} />Reset</button>
        <div className="spacer" />
        {confidence != null && <Badge tone={confidence >= 80 ? 'green' : confidence >= 60 ? 'amber' : 'red'}>{confidence}% extracted</Badge>}
        <button className="cap-store" onClick={store} disabled={extracting || storing || (!!duplicateOf && !overrideDuplicate)}>{storing ? 'Storing…' : 'Store'}</button>
        <button className="cap-tbtn icon"><I.dots size={16} /></button>
      </div>

      {extracting && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)' }}>
          <div className="row" style={{ gap: 10 }}><I.refresh size={15} style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ fontSize: 13 }}>Extracting fields with Gemini…</span></div>
        </div>
      )}
      {extractError && !extracting && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--red-soft)', border: '1px solid var(--red)' }}>
          <div className="row" style={{ gap: 10, color: 'var(--red)' }}><I.alert size={15} /><span style={{ fontSize: 13 }}>{extractError} — fill in the fields manually below.</span></div>
        </div>
      )}
      {checkingDuplicate && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--surface-2)' }}>
          <div className="row" style={{ gap: 10 }}><I.refresh size={15} style={{ animation: 'spin 0.9s linear infinite' }} /><span className="muted" style={{ fontSize: 13 }}>Checking for duplicates…</span></div>
        </div>
      )}
      {duplicateOf && !checkingDuplicate && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}>
          <div className="row" style={{ gap: 10, color: 'var(--amber)', flexWrap: 'wrap' }}>
            <I.alert size={15} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              {duplicateReason === 'file'
                ? <>This exact file was already stored as <strong>{duplicateOf.code}</strong> ({duplicateOf.vendor}, {duplicateOf.status}).</>
                : <>Possible duplicate — <strong>{duplicateOf.code}</strong> from {duplicateOf.vendor} with this invoice number already exists ({duplicateOf.status}).</>}
            </span>
            <div className="spacer" />
            <button className="btn ghost sm" onClick={() => go('invoices', duplicateOf.code)}>View existing<I.arrowR size={14} /></button>
            {!overrideDuplicate && (
              <button className="btn sm" onClick={() => {
                setOverrideDuplicate(true);
                if (duplicateReason === 'file' && file) runExtraction(file);
              }}>{duplicateReason === 'file' ? 'Extract anyway' : 'Store anyway'}</button>
            )}
          </div>
        </div>
      )}

      {/* Two panes */}
      <div className="cap-panes">
        {/* LEFT — indexing form */}
        <div className="cap-form">
          <CapField label="Document Type"><CapInput value={form.docType} readOnly /></CapField>
          <CapField label="Status"><CapInput value={form.status} readOnly /></CapField>
          <CapField label="XML Status"><CapInput value={form.xmlStatus} readOnly /></CapField>

          <CapField label="Date" hlKey="date" activeField={activeField} onSelect={setActiveField}>
            <CapDate value={form.date} onChange={v => set('date', v)} active invalid={dateInvalid} />
            {dateInvalid && <div className="cap-err"><I.alert size={12} />Date is more than {MAX_DATE_AGE_MONTHS} months old — not accepted</div>}
          </CapField>
          <CapField label="Due Date" hlKey="dueDate" activeField={activeField} onSelect={setActiveField}>
            <CapDate value={form.dueDate} onChange={v => set('dueDate', v)} />
          </CapField>

          <CapField label="Vendor" hlKey="vendor" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendor} onChange={v => set('vendor', v)} chevron /></CapField>
          <CapField label="Amount" hlKey="total" activeField={activeField} onSelect={setActiveField}><CapInput value={form.amount} onChange={v => set('amount', v)} chevron /></CapField>
          <CapField label="Purchase Order Number" hlKey="po" activeField={activeField} onSelect={setActiveField}><CapInput value={form.po} onChange={v => set('po', v)} chevron /></CapField>
          <CapField label="Company Code" hlKey="companyCode" activeField={activeField} onSelect={setActiveField}>
            <CapSelect value={form.companyCode} onChange={v => set('companyCode', v)} options={CAP_COMPANY_CODES} />
            {!form.companyCode && <div className="cap-err"><I.alert size={12} />Not found on document — select the correct code</div>}
          </CapField>
          <CapField label="Invoice Number" hlKey="invoiceNo" activeField={activeField} onSelect={setActiveField}><CapInput value={form.invoiceNumber} onChange={v => set('invoiceNumber', v)} chevron /></CapField>
          <CapField label="Vendor Reference" hlKey="vendorRef" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendorRef} onChange={v => set('vendorRef', v)} chevron /></CapField>

          <CapField label="SAP Posting Type">
            <CapSelect value={form.sapPostingType} onChange={v => set('sapPostingType', v)} options={CAP_SAP_TYPES} />
          </CapField>
          <CapField label="SAP Invoice Text">
            <input className="cap-input" style={{ height: 'auto', paddingTop: 6, paddingBottom: 6, paddingRight: 9 }}
              value={form.sapInvText} onChange={e => set('sapInvText', e.target.value)} placeholder="" />
          </CapField>

          <CapField label="Stock / Non Stock">
            <CapSelect value={form.stockType} onChange={v => set('stockType', v)} options={CAP_STOCK_TYPES} />
          </CapField>
          <CapField label="Stock Document Number">
            <CapInput value={form.stockDocNumber} onChange={v => set('stockDocNumber', v)} chevron
              disabled={form.stockType === 'Non-stock'} />
          </CapField>
          <CapField label="Non-Stock Document Number">
            <CapInput value={form.nonStockDocNumber} onChange={v => set('nonStockDocNumber', v)} chevron
              disabled={form.stockType === 'Stock'} />
          </CapField>

          {/* Line items — extracted from the document by Gemini; review/edit before storing */}
          <CapField label="Line Items" top>
            <div className="cap-mat-head">
              <span className="cap-mat-count">{lineItems.length} lines</span>
              <div className="spacer" />
              <button className="cap-mat-autofill" onClick={addLineItem}><I.plus size={13} />Add line</button>
            </div>
            <div className="cap-mat-table">
              <div className="cap-li-row cap-mat-colhead">
                <div>Description</div>
                <div style={{ textAlign: 'right' }}>Qty</div>
                <div style={{ textAlign: 'right' }}>Unit</div>
                <div style={{ textAlign: 'right' }}>Amount</div>
                <div>GL</div>
                <div />
              </div>
              <div className="cap-mat-body">
                {lineItems.map((li, i) => (
                  <div key={i} className="cap-li-row cap-mat-row">
                    <input className="cap-mat-input" value={li.description} placeholder="Description"
                      onChange={e => updateLineItem(i, { description: e.target.value })} />
                    <input className="cap-mat-input num" value={li.qty} placeholder="Qty"
                      onChange={e => updateLineItem(i, { qty: Number(e.target.value) || 0 })} />
                    <input className="cap-mat-input num" value={li.unitPrice} placeholder="Unit"
                      onChange={e => updateLineItem(i, { unitPrice: Number(e.target.value) || 0 })} />
                    <input className="cap-mat-input num" value={li.amount} placeholder="Amount"
                      onChange={e => updateLineItem(i, { amount: Number(e.target.value) || 0 })} />
                    <input className="cap-mat-input" value={li.glCode ?? ''} placeholder="GL"
                      onChange={e => updateLineItem(i, { glCode: e.target.value || null })} />
                    <button className="cap-mat-del" onClick={() => removeLineItem(i)}><I.x size={13} /></button>
                  </div>
                ))}
                {lineItems.length === 0 && <div className="cap-mat-empty">No line items captured — add one manually if needed</div>}
              </div>
            </div>
          </CapField>

          {/* Material Code table */}
          <CapField label="Material Code" top>
            <div className="cap-mat-head">
              <span className="cap-mat-count">{rows.length} rows</span>
              <div className="spacer" />
              <button className="cap-mat-autofill" onClick={() => toast('Autofill table')}><I.pin size={13} />Autofill Table</button>
              <button className="cap-tbtn icon" title="Table options"><I.dashboard size={15} /></button>
            </div>
            <div className="cap-mat-table">
              <div className="cap-mat-row cap-mat-colhead">
                <div>Item</div>
                <div>Material</div>
              </div>
              <div className="cap-mat-body">
                <button className="cap-mat-add" onClick={() => setRows(r => [...r, { item: '', material: '' }])} title="Add row"><I.plus size={14} /></button>
                {rows.map((r, i) => (
                  <div key={i} className="cap-mat-row">
                    <input className="cap-mat-input" value={r.item} placeholder="Item" onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                    <input className="cap-mat-input" value={r.material} placeholder="Material" onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, material: e.target.value } : x))} />
                    <button className="cap-mat-del" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><I.x size={13} /></button>
                  </div>
                ))}
                {rows.length === 0 && <div className="cap-mat-empty">No material lines</div>}
              </div>
            </div>
          </CapField>
        </div>

        {/* RIGHT — document viewer */}
        <div className="cap-viewer">
          <div className="cap-vtoolbar">
            {[I.doc, I.edit, I.download, I.send, I.link].map((Ico, i) => <button key={i} className="cap-vbtn"><Ico size={15} /></button>)}
            <div className="cap-vdiv" />
            <span className="cap-zoom">100%</span>
            <button className="cap-vbtn"><I.search size={15} /></button>
            <button className="cap-vbtn"><I.refresh size={15} /></button>
            <div className="cap-vdiv" />
            <button className="cap-vbtn"><I.edit size={15} /></button>
            <button className="cap-vbtn"><I.tag size={15} /></button>
            <div className="spacer" />
            <span className="cap-vpage">Page 1 / 1</span>
          </div>
          <div className="cap-vcanvas">
            <DocumentHighlightPreview url={previewUrl} mimeType={file?.type ?? null} fileName={file?.name} boxes={boxes} activeField={activeField} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CapField({ label, top, hlKey, activeField, onSelect, children }: {
  label: string; top?: boolean; hlKey?: string; activeField?: string | null; onSelect?: (k: string | null) => void; children: React.ReactNode;
}) {
  const active = !!hlKey && activeField === hlKey;
  return (
    <div
      className={cx('cap-field', top && 'top', hlKey && 'cap-field-hl', active && 'cap-field-active')}
      onMouseEnter={() => { if (hlKey) onSelect?.(hlKey); }}
      onMouseLeave={() => { if (hlKey) onSelect?.(null); }}
      onClick={() => { if (hlKey) onSelect?.(active ? null : hlKey); }}
    >
      <label>{label}</label>
      <div>{children}</div>
    </div>
  );
}

function CapInput({ value, onChange, readOnly, chevron, disabled }: {
  value: string | number; onChange?: (v: string) => void; readOnly?: boolean; chevron?: boolean; disabled?: boolean;
}) {
  return (
    <div className="cap-fieldbox">
      <input className={cx('cap-input', readOnly && 'readonly', chevron && 'has-chevron')}
        value={value} readOnly={readOnly} disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined} />
      {chevron && !disabled && <I.chevD size={15} className="cap-chev" />}
    </div>
  );
}

function CapSelect({ value, onChange, options }: {
  value: string | number; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="cap-fieldbox">
      <select className="cap-input has-chevron" value={value} onChange={e => onChange(e.target.value)} style={{ appearance: 'none', WebkitAppearance: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <I.chevD size={15} className="cap-chev" />
    </div>
  );
}

function CapDate({ value, onChange, active, invalid }: {
  value: string; onChange: (v: string) => void; active?: boolean; invalid?: boolean;
}) {
  return (
    <div className="cap-fieldbox">
      <input type="date" className={cx('cap-input', invalid && 'invalid', active && !invalid && 'active')}
        value={value} min={dateFloorISO()} max={TODAY_ISO} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
