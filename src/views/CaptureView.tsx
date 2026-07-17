'use client';

/* Document Capture — "Store to Documents" workspace */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { I } from '@/components/icons';
import { Badge, PageHeader } from '@/components/ui';
import { cx } from '@/lib/utils';
import { daysAgo } from '@/lib/format';
import { useToast } from '@/components/providers/ToastProvider';
import { useGo } from '@/lib/navigation';
import { extractDocument } from '@/lib/server/extraction';
import { createInvoiceFromExtraction, findDuplicateInvoice, findDuplicateInvoiceByHash } from '@/lib/server/invoices';
import { genInvoiceCode } from '@/lib/server/codes';
import { DocumentHighlightPreview } from '@/components/DocumentHighlightPreview';
import { sha256Hex } from '@/lib/hash';
import { ACCEPTED_UPLOAD_TYPES, ACCEPTED_UPLOAD_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/lib/uploadConstraints';
import { COMPANY_CODES, nonStockDocOptions } from '@/lib/constants';
import { useTr } from '@/lib/i18n';
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
  documentNumber: string; comment: string;
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
  documentNumber: '',
  comment: '',
};

/** Maps Gemini's extraction result (src/lib/gemini/extract.ts) onto the
 * capture indexing form's fields (SOW §5.1 auto-extract requirement). Used
 * for both Standard and Special Invoice — Special just displays a
 * different subset of these same fields (see the kind-conditional form
 * below) plus its own Document Number, which Gemini doesn't extract. */
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
    documentNumber: '',
    comment: '',
  };
}

interface MaterialRow { item: string; material: string }

// Special Invoice's Material Code table — replaces Line Items entirely for
// that kind (per the DocuWare Special Invoice form: Item/Material/
// Description/Total/UOM, no Qty/Unit Price/GL Code).
interface SpecialMaterialRow { item: string; material: string; description: string; total: number; uom: string }

type CapKind = 'standard' | 'special';
type DuplicateReason = 'file' | 'invoice' | 'batch' | null;

// One queued document — everything that used to be single top-level state
// (form/lineItems/boxes/duplicate flags/etc.) now lives per-document so
// several invoices can be uploaded, extracted, and reviewed in one batch.
interface CapDoc {
  id: string;
  kind: CapKind;
  // Generated up front (not at Store time) so the code shown throughout
  // review is the exact one that ends up stored — previously the server
  // generated its own code at Store, which the reviewer never saw in advance.
  code: string;
  file: File;
  previewUrl: string;
  form: CapForm;
  rows: MaterialRow[];
  lineItems: ExtractedInvoice['lineItems'];
  materialRows: SpecialMaterialRow[];
  boxes: ExtractedInvoice['boxes'];
  confidence: number | null;
  extracting: boolean;
  extractError: string | null;
  documentHash: string | null;
  checkingDuplicate: boolean;
  duplicateOf: InvoiceRow | null;
  duplicateReason: DuplicateReason;
  duplicateBatchWith: string | null; // sibling file name, when duplicateReason === 'batch'
  overrideDuplicate: boolean;
  stored: boolean;
}

function makeDoc(id: string, file: File, kind: CapKind): CapDoc {
  return {
    id, kind, code: genInvoiceCode(), file, previewUrl: URL.createObjectURL(file),
    form: { ...INITIAL_FORM }, rows: [], lineItems: [], materialRows: [], boxes: [],
    confidence: null, extracting: false, extractError: null,
    documentHash: null, checkingDuplicate: false,
    duplicateOf: null, duplicateReason: null, duplicateBatchWith: null,
    overrideDuplicate: false, stored: false,
  };
}

// =================== DOCUMENT CAPTURE — "Store to Documents" ===================
export function CaptureView() {
  const tr = useTr();
  const toast = useToast();
  const go = useGo();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const uploadKindRef = useRef<CapKind>('standard');
  const [docs, setDocs] = useState<CapDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dragKind, setDragKind] = useState<CapKind | null>(null);
  const [storingId, setStoringId] = useState<string | null>(null);
  const [storedSummary, setStoredSummary] = useState<{ code: string; vendor: string }[]>([]);

  function openUpload(kind: CapKind) {
    uploadKindRef.current = kind;
    fileInputRef.current?.click();
  }

  // Mirrors `docs` synchronously for cross-document duplicate checks inside
  // async handlers, where the `docs` closure would otherwise be stale.
  const docsRef = useRef<CapDoc[]>([]);
  useEffect(() => { docsRef.current = docs; }, [docs]);

  function updateDoc(id: string, patch: Partial<CapDoc> | ((d: CapDoc) => Partial<CapDoc>)) {
    setDocs(ds => ds.map(d => d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d));
  }

  async function runExtraction(id: string, f: File) {
    updateDoc(id, { extracting: true, extractError: null, confidence: null });
    const result = await extractDocument(f);
    if (!result.ok) {
      updateDoc(id, { extracting: false, extractError: result.error });
      toast(`Extraction failed for ${f.name}: ${result.error}`);
      return;
    }
    // Same Gemini extraction for both kinds — Special Invoice just reshapes
    // the extracted line items into its Material Code table (Item/Material
    // are left blank since Gemini has no concept of them yet; Description
    // and Total carry over).
    const kind = docsRef.current.find(d => d.id === id)?.kind ?? 'standard';
    updateDoc(id, {
      extracting: false,
      form: formFromExtraction(result.data),
      lineItems: kind === 'standard' ? result.data.lineItems : [],
      materialRows: kind === 'special' ? result.data.lineItems.map(li => ({ item: '', material: '', description: li.description, total: li.amount, uom: '' })) : [],
      boxes: result.data.boxes,
      confidence: result.data.confidence,
    });
    toast(`${f.name}: fields extracted — review before storing`);

    // Batch-internal: another queued document already extracted the same
    // vendor + invoice number (the file-hash check below only catches byte-
    // identical re-uploads, not a re-scan of the same paper).
    const batchDupe = docsRef.current.find(d => d.id !== id &&
      d.form.vendor.trim().toLowerCase() === result.data.vendor.trim().toLowerCase() &&
      d.form.invoiceNumber.trim().toLowerCase() === result.data.invoiceNo.trim().toLowerCase());
    if (batchDupe) {
      updateDoc(id, { duplicateReason: 'batch', duplicateBatchWith: batchDupe.file.name });
      return;
    }

    updateDoc(id, { checkingDuplicate: true });
    const found = await findDuplicateInvoice(result.data.vendor, result.data.invoiceNo);
    updateDoc(id, { checkingDuplicate: false });
    if (found) updateDoc(id, { duplicateOf: found, duplicateReason: 'invoice' });
  }

  async function processDoc(id: string, f: File) {
    updateDoc(id, { checkingDuplicate: true });
    const hash = await sha256Hex(await f.arrayBuffer());
    updateDoc(id, { documentHash: hash });

    // Exact same file already sitting elsewhere in this same upload.
    const batchDupe = docsRef.current.find(d => d.id !== id && d.documentHash === hash);
    if (batchDupe) {
      updateDoc(id, { checkingDuplicate: false, duplicateReason: 'batch', duplicateBatchWith: batchDupe.file.name });
      return;
    }

    // Exact-file check against what's already stored — deterministic, and
    // cheap enough to run before spending a Gemini call on a document we
    // already have.
    const hashDupe = await findDuplicateInvoiceByHash(hash);
    updateDoc(id, { checkingDuplicate: false });
    if (hashDupe) {
      updateDoc(id, { duplicateOf: hashDupe, duplicateReason: 'file' });
      return;
    }
    await runExtraction(id, f);
  }

  async function handleFiles(files: File[], kind: CapKind) {
    const valid: File[] = [];
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      const typeOk = ACCEPTED_UPLOAD_TYPES.includes(f.type) || ACCEPTED_UPLOAD_EXTENSIONS.includes(ext);
      if (!typeOk) { toast(`${f.name}: unsupported file type — upload a PDF, PNG, JPG, WEBP, or HEIC.`); continue; }
      if (f.size > MAX_UPLOAD_BYTES) { toast(`${f.name} is too large (${(f.size / 1024 / 1024).toFixed(1)} MB) — max 15 MB.`); continue; }
      valid.push(f);
    }
    if (valid.length === 0) return;
    setStoredSummary([]); // starting a fresh batch — last batch's summary no longer applies
    const newDocs = valid.map(f => makeDoc(`doc-${nextId.current++}`, f, kind));
    setDocs(ds => [...ds, ...newDocs]);
    setActiveId(prev => prev ?? newDocs[0].id);
    for (const doc of newDocs) processDoc(doc.id, doc.file);
  }

  function removeDoc(id: string) {
    setDocs(ds => {
      const doc = ds.find(d => d.id === id);
      if (doc) URL.revokeObjectURL(doc.previewUrl);
      return ds.filter(d => d.id !== id);
    });
    setActiveId(prev => {
      if (prev !== id) return prev;
      const remaining = docsRef.current.filter(d => d.id !== id);
      return remaining[0]?.id ?? null;
    });
  }

  function advanceAfterStore(justStoredId: string) {
    const remaining = docsRef.current.filter(d => d.id !== justStoredId && !d.stored);
    if (remaining.length > 0) {
      setActiveId(remaining[0].id);
      return;
    }
    // Batch done. Previously this jumped straight into the last invoice's
    // detail page, which only gave that one document a direct link —
    // every earlier document in the batch had no way back except hunting
    // for it in the Invoices list. Clearing the queue instead surfaces the
    // landing screen's "Just stored" summary, which links to every
    // invoice from this batch equally.
    docsRef.current.forEach(d => URL.revokeObjectURL(d.previewUrl));
    setDocs([]);
    setActiveId(null);
  }

  const active = docs.length > 0 ? (docs.find(d => d.id === activeId) ?? docs[0]) : null;

  const set = (k: keyof CapForm, v: string | number) => { if (active) updateDoc(active.id, d => ({ form: { ...d.form, [k]: v } })); };
  function updateLineItem(i: number, patch: Partial<ExtractedInvoice['lineItems'][number]>) {
    if (!active) return;
    updateDoc(active.id, d => ({ lineItems: d.lineItems.map((it, j) => j === i ? { ...it, ...patch } : it) }));
  }
  function addLineItem() {
    if (!active) return;
    updateDoc(active.id, d => ({ lineItems: [...d.lineItems, { description: '', qty: 1, unitPrice: 0, amount: 0, glCode: null }] }));
  }
  function removeLineItem(i: number) {
    if (!active) return;
    updateDoc(active.id, d => ({ lineItems: d.lineItems.filter((_, j) => j !== i) }));
  }
  function setRows(updater: (rows: MaterialRow[]) => MaterialRow[]) {
    if (!active) return;
    updateDoc(active.id, d => ({ rows: updater(d.rows) }));
  }
  function updateMaterialRow(i: number, patch: Partial<SpecialMaterialRow>) {
    if (!active) return;
    updateDoc(active.id, d => ({ materialRows: d.materialRows.map((r, j) => j === i ? { ...r, ...patch } : r) }));
  }
  function addMaterialRow() {
    if (!active) return;
    updateDoc(active.id, d => ({ materialRows: [...d.materialRows, { item: '', material: '', description: '', total: 0, uom: '' }] }));
  }
  function removeMaterialRow(i: number) {
    if (!active) return;
    updateDoc(active.id, d => ({ materialRows: d.materialRows.filter((_, j) => j !== i) }));
  }

  async function store() {
    if (!active) return;
    const { kind, code, form, lineItems, materialRows, documentHash, confidence, duplicateOf, duplicateReason, overrideDuplicate, file } = active;
    if (dateTooOld(form.date)) { toast(`Date cannot be more than ${MAX_DATE_AGE_MONTHS} months old`); return; }
    if (!form.vendor.trim() || !form.invoiceNumber.trim() || !form.date || !form.companyCode) {
      toast('Vendor, Invoice Number, Date, and Company Code are required'); return;
    }
    if (duplicateOf && !overrideDuplicate) {
      toast(`Looks like a duplicate of ${duplicateOf.code} — confirm below to store anyway`); return;
    }
    if (duplicateReason === 'batch' && !overrideDuplicate) {
      toast(`Looks like a duplicate within this upload — confirm below to store anyway`); return;
    }
    setStoringId(active.id);
    try {
      const invoice = await createInvoiceFromExtraction({
        code,
        vendor: form.vendor,
        invoiceNo: form.invoiceNumber,
        date: form.date,
        dueDate: form.dueDate,
        po: form.po || null,
        companyCode: form.companyCode,
        vendorRef: form.vendorRef,
        stockType: (form.stockType || null) as 'Stock' | 'Non-stock' | 'Stock & Non Stock' | null,
        amount: Number(form.amount) || 0,
        lineItems: kind === 'standard'
          ? lineItems.map(li => ({ description: li.description, qty: li.qty, unitPrice: li.unitPrice, amount: li.amount, glCode: li.glCode }))
          : materialRows.map(r => ({ description: r.description, qty: 1, unitPrice: r.total, amount: r.total, glCode: null, item: r.item || null, material: r.material || null, uom: r.uom || null })),
        confidence,
        documentHash,
        sapPostingType: form.sapPostingType || null,
        sapInvText: form.sapInvText || null,
        invoiceKind: kind === 'special' ? 'Special' : 'Standard',
        documentNumber: kind === 'special' ? (form.documentNumber || null) : null,
      }, file);
      toast(`Stored as ${invoice.code}`);
      updateDoc(active.id, { stored: true });
      URL.revokeObjectURL(active.previewUrl);
      setStoredSummary(s => [...s, { code: invoice.code, vendor: form.vendor }]);
      advanceAfterStore(active.id);
    } catch (err) {
      toast(`Store failed: ${errorMessage(err)}`);
    } finally {
      setStoringId(null);
    }
  }
  function resetActive() {
    if (!active) return;
    updateDoc(active.id, { form: { ...INITIAL_FORM }, rows: [], materialRows: [] });
    toast('Form reset');
  }
  function cancelActive() {
    if (!active) return;
    removeDoc(active.id);
  }

  // Upload landing — the Store screen only appears once at least one
  // document is uploaded
  if (!active) {
    return (
      <div className="view-enter">
        <PageHeader title={tr('Document Capture')}
          sub={tr('Upload one or more documents to capture and index them into the portal.')}
        />
        <input ref={fileInputRef} type="file" multiple accept={[...ACCEPTED_UPLOAD_TYPES, ...ACCEPTED_UPLOAD_EXTENSIONS].join(',')} style={{ display: 'none' }}
          onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) handleFiles(files, uploadKindRef.current); e.target.value = ''; }} />

        {/* Every document just stored gets an equally direct link here —
            previously only the last one in a batch got a hand-off (via
            auto-navigation), leaving earlier ones with no direct path back. */}
        {storedSummary.length > 0 && (
          <div className="card" style={{ marginBottom: 'var(--gap-5)', overflow: 'hidden' }}>
            <div className="card-head">
              <div className="card-title">{tr('Just stored')}</div>
              <Badge tone="green">{storedSummary.length}</Badge>
            </div>
            <div>
              {storedSummary.map((s, i) => (
                <div key={s.code} className="row" style={{ justifyContent: 'space-between', padding: '10px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <I.check size={15} style={{ color: 'var(--green)' }} />
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-strong)', fontSize: 13 }}>{s.code}</span>
                    <span style={{ fontSize: 13 }}>{s.vendor}</span>
                  </div>
                  <button className="btn ghost sm" onClick={() => go('invoices', s.code)}>{tr('Open')}<I.arrowR size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Two blocks — Standard vs Special Invoice — since they capture a
            different field set (Special has its own Document Number and a
            Material Code table instead of Line Items). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-5)' }}>
          {([
            { kind: 'standard' as const, title: tr('Standard Invoice'), desc: tr('The regular invoice flow — Description, Qty, Unit Price, GL Code line items.') },
            { kind: 'special' as const, title: tr('Special Invoice'), desc: tr('Adds a Document Number field, and a Material Code table (Item, Material, UOM) instead of line items.') },
          ]).map(({ kind, title, desc }) => (
            <div key={kind}
              onDragOver={(e) => { e.preventDefault(); setDragKind(kind); }}
              onDragLeave={() => setDragKind(k => k === kind ? null : k)}
              onDrop={(e) => { e.preventDefault(); setDragKind(null); const files = Array.from(e.dataTransfer.files ?? []); if (files.length) handleFiles(files, kind); }}
              onClick={() => openUpload(kind)}
              className="card"
              style={{
                border: dragKind === kind ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
                background: dragKind === kind ? 'var(--accent-softer)' : 'var(--surface)',
                padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                minHeight: 'calc(100vh - 320px)', justifyContent: 'center',
              }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                <I.upload size={26} />
              </div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
              <div className="muted" style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>{desc}</div>
              <div className="row" style={{ gap: 10, marginTop: 4 }}>
                <button className="btn primary" onClick={(e) => { e.stopPropagation(); openUpload(kind); }}><I.upload size={15} />{tr('Upload document')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { kind, form, lineItems, materialRows, boxes, rows, confidence, extracting, extractError, checkingDuplicate, duplicateOf, duplicateReason, duplicateBatchWith, overrideDuplicate, previewUrl, file } = active;
  const dateInvalid = dateTooOld(form.date);
  const blockedByDuplicate = duplicateReason !== null && !overrideDuplicate;
  const remainingAfterThis = docs.filter(d => !d.stored && d.id !== active.id).length;

  return (
    <div className="cap-wrap view-enter">
      <input ref={fileInputRef} type="file" multiple accept={[...ACCEPTED_UPLOAD_TYPES, ...ACCEPTED_UPLOAD_EXTENSIONS].join(',')} style={{ display: 'none' }}
        onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) handleFiles(files, uploadKindRef.current); e.target.value = ''; }} />

      {/* Queue strip — only shown once there's more than one document to switch between */}
      {docs.length > 1 && (
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {docs.map((d, i) => (
            <button key={d.id} onClick={() => setActiveId(d.id)}
              className={cx('btn', 'sm', d.id === active.id ? 'primary' : 'ghost')}
              style={{ gap: 6 }} title={d.file.name}>
              {d.stored
                ? <I.check size={13} />
                : d.duplicateReason
                  ? <I.alert size={13} />
                  : (d.extracting || d.checkingDuplicate) ? <I.refresh size={13} style={{ animation: 'spin 0.9s linear infinite' }} /> : null}
              {i + 1}. {d.file.name.length > 18 ? `${d.file.name.slice(0, 16)}…` : d.file.name}
            </button>
          ))}
          <button className="btn ghost sm" onClick={() => openUpload(active.kind)}><I.plus size={13} />{tr('Add more')}</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="cap-toolbar">
        <button className="cap-tbtn" onClick={cancelActive}><I.chevL size={15} />{tr('Cancel')}</button>
        <button className="cap-tbtn" onClick={resetActive}><I.refresh size={14} />{tr('Reset')}</button>
        {docs.length === 1 && <button className="cap-tbtn" onClick={() => openUpload(active.kind)}><I.plus size={14} />{tr('Add more')}</button>}
        <div className="spacer" />
        {confidence != null && <Badge tone={confidence >= 80 ? 'green' : confidence >= 60 ? 'amber' : 'red'}>{confidence}% {tr('extracted')}</Badge>}
        <button className="cap-store" onClick={store} disabled={extracting || storingId === active.id || blockedByDuplicate}>
          {storingId === active.id ? tr('Storing…') : remainingAfterThis > 0 ? tr('Store & Next') : tr('Store')}
        </button>
        <button className="cap-tbtn icon"><I.dots size={16} /></button>
      </div>

      {extracting && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)' }}>
          <div className="row" style={{ gap: 10 }}><I.refresh size={15} style={{ animation: 'spin 0.9s linear infinite' }} /><span style={{ fontSize: 13 }}>{tr('Extracting fields…')}</span></div>
        </div>
      )}
      {extractError && !extracting && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--red-soft)', border: '1px solid var(--red)' }}>
          <div className="row" style={{ gap: 10, color: 'var(--red)' }}><I.alert size={15} /><span style={{ fontSize: 13 }}>{extractError} — {tr('fill in the fields manually below.')}</span></div>
        </div>
      )}
      {checkingDuplicate && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--surface-2)' }}>
          <div className="row" style={{ gap: 10 }}><I.refresh size={15} style={{ animation: 'spin 0.9s linear infinite' }} /><span className="muted" style={{ fontSize: 13 }}>{tr('Checking for duplicates…')}</span></div>
        </div>
      )}
      {duplicateOf && !checkingDuplicate && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}>
          <div className="row" style={{ gap: 10, color: 'var(--amber)', flexWrap: 'wrap' }}>
            <I.alert size={15} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              {duplicateReason === 'file'
                ? <>{tr('This exact file was already stored as')} <strong>{duplicateOf.code}</strong> ({duplicateOf.vendor}, {duplicateOf.status}).</>
                : <>{tr('Possible duplicate —')} <strong>{duplicateOf.code}</strong> {tr('from')} {duplicateOf.vendor} {tr('with this invoice number already exists')} ({duplicateOf.status}).</>}
            </span>
            <div className="spacer" />
            <button className="btn ghost sm" onClick={() => go('invoices', duplicateOf.code)}>{tr('View existing')}<I.arrowR size={14} /></button>
            {!overrideDuplicate && (
              <button className="btn sm" onClick={() => {
                updateDoc(active.id, { overrideDuplicate: true });
                if (duplicateReason === 'file') runExtraction(active.id, file);
              }}>{duplicateReason === 'file' ? tr('Extract anyway') : tr('Store anyway')}</button>
            )}
          </div>
        </div>
      )}
      {duplicateReason === 'batch' && !checkingDuplicate && (
        <div className="card" style={{ padding: '10px 16px', marginBottom: 12, background: 'var(--amber-soft)', border: '1px solid var(--amber)' }}>
          <div className="row" style={{ gap: 10, color: 'var(--amber)', flexWrap: 'wrap' }}>
            <I.alert size={15} />
            <span style={{ fontSize: 13, color: 'var(--text)' }}>
              {tr('This looks like the same invoice as')} <strong>{duplicateBatchWith}</strong> {tr('already queued in this same upload.')}
            </span>
            <div className="spacer" />
            {!overrideDuplicate && (
              <button className="btn sm" onClick={() => updateDoc(active.id, { overrideDuplicate: true })}>{tr('Store anyway')}</button>
            )}
          </div>
        </div>
      )}

      {/* Two panes */}
      <div className="cap-panes">
        {/* LEFT — indexing form */}
        <div className="cap-form">
          {kind === 'special' ? (
            <>
              <CapField label={tr('Document Type')}><CapInput value={tr('Special Invoice')} readOnly /></CapField>
              <CapField label={tr('Status')}><CapInput value={form.status} readOnly /></CapField>
              <CapField label={tr('Invoice Code')}><CapInput value={active.code} readOnly /></CapField>

              <CapField label={tr('Date')} hlKey="date" activeField={activeField} onSelect={setActiveField}>
                <CapDate value={form.date} onChange={v => set('date', v)} active invalid={dateInvalid} />
                {dateInvalid && <div className="cap-err"><I.alert size={12} />{tr('Date is more than')} {MAX_DATE_AGE_MONTHS} {tr('months old — not accepted')}</div>}
              </CapField>
              <CapField label={tr('Due Date')} hlKey="dueDate" activeField={activeField} onSelect={setActiveField}>
                <CapDate value={form.dueDate} onChange={v => set('dueDate', v)} />
              </CapField>

              <CapField label={tr('Vendor')} hlKey="vendor" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendor} onChange={v => set('vendor', v)} chevron /></CapField>
              <CapField label={tr('Amount')} hlKey="total" activeField={activeField} onSelect={setActiveField}><CapInput value={form.amount} onChange={v => set('amount', v)} chevron /></CapField>
              <CapField label={tr('Purchase Order Number')} hlKey="po" activeField={activeField} onSelect={setActiveField}><CapInput value={form.po} onChange={v => set('po', v)} chevron /></CapField>
              <CapField label={tr('Company Code')} hlKey="companyCode" activeField={activeField} onSelect={setActiveField}>
                <CapSelect value={form.companyCode} onChange={v => set('companyCode', v)} options={CAP_COMPANY_CODES} />
                {!form.companyCode && <div className="cap-err"><I.alert size={12} />{tr('Not found on document — select the correct code')}</div>}
              </CapField>
              <CapField label={tr('Invoice Number')} hlKey="invoiceNo" activeField={activeField} onSelect={setActiveField}><CapInput value={form.invoiceNumber} onChange={v => set('invoiceNumber', v)} chevron /></CapField>
              <CapField label={tr('Vendor Reference')} hlKey="vendorRef" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendorRef} onChange={v => set('vendorRef', v)} chevron /></CapField>
              <CapField label={tr('Document Number')}><CapInput value={form.documentNumber} onChange={v => set('documentNumber', v)} chevron /></CapField>

              {/* Material Code — replaces Line Items entirely for Special Invoice */}
              <CapField label={tr('Material Code')} top>
                <div className="cap-mat-head">
                  <span className="cap-mat-count">{materialRows.length} {tr('rows')}</span>
                  <div className="spacer" />
                  <button className="cap-mat-autofill" onClick={addMaterialRow}><I.plus size={13} />{tr('Add row')}</button>
                </div>
                <div className="cap-mat-table">
                  <div className="cap-li-row cap-mat-colhead">
                    <div>{tr('Item')}</div>
                    <div>{tr('Material')}</div>
                    <div>{tr('Description')}</div>
                    <div style={{ textAlign: 'right' }}>{tr('Total')}</div>
                    <div>{tr('UOM')}</div>
                    <div />
                  </div>
                  <div className="cap-mat-body">
                    {materialRows.map((r, i) => (
                      <div key={i} className="cap-li-row cap-mat-row">
                        <input className="cap-mat-input" value={r.item} placeholder={tr('Item')}
                          onChange={e => updateMaterialRow(i, { item: e.target.value })} />
                        <input className="cap-mat-input" value={r.material} placeholder={tr('Material')}
                          onChange={e => updateMaterialRow(i, { material: e.target.value })} />
                        <input className="cap-mat-input" value={r.description} placeholder={tr('Description')}
                          onChange={e => updateMaterialRow(i, { description: e.target.value })} />
                        <input className="cap-mat-input num" value={r.total} placeholder={tr('Total')}
                          onChange={e => updateMaterialRow(i, { total: Number(e.target.value) || 0 })} />
                        <input className="cap-mat-input" value={r.uom} placeholder={tr('UOM')}
                          onChange={e => updateMaterialRow(i, { uom: e.target.value })} />
                        <button className="cap-mat-del" onClick={() => removeMaterialRow(i)}><I.x size={13} /></button>
                      </div>
                    ))}
                    {materialRows.length === 0 && <div className="cap-mat-empty">{tr('No material lines captured — add one manually if needed')}</div>}
                  </div>
                </div>
              </CapField>

              <CapField label={tr('Comment')}>
                <input className="cap-input" style={{ height: 'auto', paddingTop: 6, paddingBottom: 6, paddingRight: 9 }}
                  value={form.comment} onChange={e => set('comment', e.target.value)} placeholder="" />
              </CapField>
            </>
          ) : (
            <>
              <CapField label={tr('Document Type')}><CapInput value={form.docType} readOnly /></CapField>
              <CapField label={tr('Status')}><CapInput value={form.status} readOnly /></CapField>
              <CapField label={tr('XML Status')}><CapInput value={form.xmlStatus} readOnly /></CapField>
              <CapField label={tr('Invoice Code')}><CapInput value={active.code} readOnly /></CapField>

              <CapField label={tr('Date')} hlKey="date" activeField={activeField} onSelect={setActiveField}>
                <CapDate value={form.date} onChange={v => set('date', v)} active invalid={dateInvalid} />
                {dateInvalid && <div className="cap-err"><I.alert size={12} />{tr('Date is more than')} {MAX_DATE_AGE_MONTHS} {tr('months old — not accepted')}</div>}
              </CapField>
              <CapField label={tr('Due Date')} hlKey="dueDate" activeField={activeField} onSelect={setActiveField}>
                <CapDate value={form.dueDate} onChange={v => set('dueDate', v)} />
              </CapField>

              <CapField label={tr('Vendor')} hlKey="vendor" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendor} onChange={v => set('vendor', v)} chevron /></CapField>
              <CapField label={tr('Amount')} hlKey="total" activeField={activeField} onSelect={setActiveField}><CapInput value={form.amount} onChange={v => set('amount', v)} chevron /></CapField>
              <CapField label={tr('Purchase Order Number')} hlKey="po" activeField={activeField} onSelect={setActiveField}><CapInput value={form.po} onChange={v => set('po', v)} chevron /></CapField>
              <CapField label={tr('Company Code')} hlKey="companyCode" activeField={activeField} onSelect={setActiveField}>
                <CapSelect value={form.companyCode} onChange={v => set('companyCode', v)} options={CAP_COMPANY_CODES} />
                {!form.companyCode && <div className="cap-err"><I.alert size={12} />{tr('Not found on document — select the correct code')}</div>}
              </CapField>
              <CapField label={tr('Invoice Number')} hlKey="invoiceNo" activeField={activeField} onSelect={setActiveField}><CapInput value={form.invoiceNumber} onChange={v => set('invoiceNumber', v)} chevron /></CapField>
              <CapField label={tr('Vendor Reference')} hlKey="vendorRef" activeField={activeField} onSelect={setActiveField}><CapInput value={form.vendorRef} onChange={v => set('vendorRef', v)} chevron /></CapField>

              <CapField label={tr('SAP Posting Type')}>
                <CapSelect value={form.sapPostingType} onChange={v => set('sapPostingType', v)} options={CAP_SAP_TYPES} />
              </CapField>
              <CapField label={tr('SAP Invoice Text')}>
                <input className="cap-input" style={{ height: 'auto', paddingTop: 6, paddingBottom: 6, paddingRight: 9 }}
                  value={form.sapInvText} onChange={e => set('sapInvText', e.target.value)} placeholder="" />
              </CapField>

              <CapField label={tr('Stock / Non Stock')}>
                <CapSelect value={form.stockType} onChange={v => set('stockType', v)} options={CAP_STOCK_TYPES} />
              </CapField>
              <CapField label={tr('Stock Document Number')}>
                <CapInput value={form.stockDocNumber} onChange={v => set('stockDocNumber', v)} chevron
                  disabled={form.stockType === 'Non-stock'} />
              </CapField>
              <CapField label={tr('Non-Stock Document Number')}>
                <CapSelect value={form.nonStockDocNumber} onChange={v => set('nonStockDocNumber', v)}
                  options={nonStockDocOptions(form.nonStockDocNumber)} disabled={form.stockType === 'Stock'} />
              </CapField>

              {/* Line items — extracted from the document by Gemini; review/edit before storing */}
              <CapField label={tr('Line Items')} top>
                <div className="cap-mat-head">
                  <span className="cap-mat-count">{lineItems.length} {tr('lines')}</span>
                  <div className="spacer" />
                  <button className="cap-mat-autofill" onClick={addLineItem}><I.plus size={13} />{tr('Add line')}</button>
                </div>
                <div className="cap-mat-table">
                  <div className="cap-li-row cap-mat-colhead">
                    <div>{tr('Description')}</div>
                    <div style={{ textAlign: 'right' }}>{tr('Qty')}</div>
                    <div style={{ textAlign: 'right' }}>{tr('Unit')}</div>
                    <div style={{ textAlign: 'right' }}>{tr('Amount')}</div>
                    <div>{tr('GL')}</div>
                    <div />
                  </div>
                  <div className="cap-mat-body">
                    {lineItems.map((li, i) => (
                      <div key={i} className="cap-li-row cap-mat-row">
                        <input className="cap-mat-input" value={li.description} placeholder={tr('Description')}
                          onChange={e => updateLineItem(i, { description: e.target.value })} />
                        <input className="cap-mat-input num" value={li.qty} placeholder={tr('Qty')}
                          onChange={e => updateLineItem(i, { qty: Number(e.target.value) || 0 })} />
                        <input className="cap-mat-input num" value={li.unitPrice} placeholder={tr('Unit')}
                          onChange={e => updateLineItem(i, { unitPrice: Number(e.target.value) || 0 })} />
                        <input className="cap-mat-input num" value={li.amount} placeholder={tr('Amount')}
                          onChange={e => updateLineItem(i, { amount: Number(e.target.value) || 0 })} />
                        <input className="cap-mat-input" value={li.glCode ?? ''} placeholder={tr('GL')}
                          onChange={e => updateLineItem(i, { glCode: e.target.value || null })} />
                        <button className="cap-mat-del" onClick={() => removeLineItem(i)}><I.x size={13} /></button>
                      </div>
                    ))}
                    {lineItems.length === 0 && <div className="cap-mat-empty">{tr('No line items captured — add one manually if needed')}</div>}
                  </div>
                </div>
              </CapField>

              {/* Material Code table */}
              <CapField label={tr('Material Code')} top>
                <div className="cap-mat-head">
                  <span className="cap-mat-count">{rows.length} {tr('rows')}</span>
                  <div className="spacer" />
                  <button className="cap-mat-autofill" onClick={() => toast('Autofill table')}><I.pin size={13} />{tr('Autofill Table')}</button>
                  <button className="cap-tbtn icon" title={tr('Table options')}><I.dashboard size={15} /></button>
                </div>
                <div className="cap-mat-table">
                  <div className="cap-mat-row cap-mat-colhead">
                    <div>{tr('Item')}</div>
                    <div>{tr('Material')}</div>
                  </div>
                  <div className="cap-mat-body">
                    <button className="cap-mat-add" onClick={() => setRows(rs => [...rs, { item: '', material: '' }])} title={tr('Add row')}><I.plus size={14} /></button>
                    {rows.map((r, i) => (
                      <div key={i} className="cap-mat-row">
                        <input className="cap-mat-input" value={r.item} placeholder={tr('Item')} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, item: e.target.value } : x))} />
                        <input className="cap-mat-input" value={r.material} placeholder={tr('Material')} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, material: e.target.value } : x))} />
                        <button className="cap-mat-del" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><I.x size={13} /></button>
                      </div>
                    ))}
                    {rows.length === 0 && <div className="cap-mat-empty">{tr('No material lines')}</div>}
                  </div>
                </div>
              </CapField>
            </>
          )}
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
            <span className="cap-vpage">{tr('Page')} 1 / 1</span>
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

function CapSelect({ value, onChange, options, disabled }: {
  value: string | number; onChange: (v: string) => void; options: string[]; disabled?: boolean;
}) {
  return (
    <div className="cap-fieldbox">
      <select className="cap-input has-chevron" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ appearance: 'none', WebkitAppearance: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o || '— Select —'}</option>)}
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
