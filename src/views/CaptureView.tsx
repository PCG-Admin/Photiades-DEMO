'use client';

/* Document Capture — "Store to Documents" workspace */
import * as React from 'react';
import { useState } from 'react';
import { I } from '@/components/icons';
import { PageHeader } from '@/components/ui';
import { cx } from '@/lib/utils';
import { daysAgo } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';

// Indexing field picklists
const CAP_STOCK_TYPES = ['', 'Stock', 'Non-stock', 'Stock & Non Stock'];
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

// the invoice shown in the document viewer (matches the captured file)
const CAP_INVOICE = {
  vendorName: 'ARDAGH METAL PACKAGING TRADING France',
  vendorAddr: ['ZI Athelia 4', '13705 La Ciotat cedex', 'France'],
  invNo: '3306814113',
  date: '22/05/2026',
  sapSo: '1091176',
  shipTo: ['Photos Photiades Breweries Ltd.', '1 Lemesos Road,', '2540 DALI, NICOSIA', 'CYPRUS'],
  shipFrom: 'MARSEILLE / France',
  booking: 'LHV4037393',
  delivery: 'CFR LIMASSOL, CYPRUS',
  exporter: 'APPROVED EXPORTER FR002730/0122  --  VAT N°: FR 31 820 890 119',
  lines: [
    { line: '010', article: ['CANS 330ml ALU Standard (non returnable packaging)', '332A+FWCW PNG CARLSBERG 00 330 CYP', '22130202'], qty: '373 440', price: '93,15 EUR', total: '34 785,93 €' },
  ],
  incoterm: 'CFR LIMASSOL',
  incotermValue: '34 785,93 €',
  grossWeight: '5926,494 kgs',
  custRef: 'PO 4500174435',
  totalValue: '34 785,93',
};

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
  vendor: 'Ardagh Metal Packaging Trading France LTD',
  amount: 34785.93,
  po: '4500174434',
  companyCode: '1000',
  invoiceNumber: '13705',
  vendorRef: '203587',
  sapPostingType: 'Invoice',
  sapInvText: '',
  stockType: '',
  stockDocNumber: '',
  nonStockDocNumber: '',
};

interface MaterialRow { item: string; material: string }

// =================== DOCUMENT CAPTURE — "Store to Documents" ===================
export function CaptureView() {
  const toast = useToast();
  const [form, setForm] = useState<CapForm>(INITIAL_FORM);
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [uploaded, setUploaded] = useState(false);
  const [drag, setDrag] = useState(false);
  const [hl, setHl] = useState<string | null>(null);
  const set = (k: keyof CapForm, v: string | number) => setForm(f => ({ ...f, [k]: v }));
  const dateInvalid = dateTooOld(form.date);

  function doUpload() {
    setForm(INITIAL_FORM); setRows([]); setUploaded(true);
    toast('Document uploaded — ready to index');
  }
  function store() {
    if (dateInvalid) { toast(`Date cannot be more than ${MAX_DATE_AGE_MONTHS} months old`); return; }
    toast('Stored to “Documents”');
    setUploaded(false);
  }
  function reset() { setForm(INITIAL_FORM); setRows([]); toast('Form reset'); }

  // Upload landing — the Store screen only appears once a document is uploaded
  if (!uploaded) {
    return (
      <div className="view-enter">
        <PageHeader title="Document Capture"
          sub="Upload a document to capture and index it into the portal."
          actions={<button className="btn primary" onClick={doUpload}><I.upload size={16} />Upload document</button>}
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); doUpload(); }}
          onClick={doUpload}
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
          <div className="muted" style={{ fontSize: 13.5, maxWidth: 380, lineHeight: 1.5 }}>or click to browse · PDF, TIFF, JPG, PNG. The document is classified and the Store form opens for indexing.</div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <button className="btn primary lg" onClick={(e) => { e.stopPropagation(); doUpload(); }}><I.upload size={16} />Upload document</button>
            <button className="btn lg" onClick={(e) => { e.stopPropagation(); doUpload(); }}><I.scan size={16} />Scan</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cap-wrap view-enter">
      {/* Toolbar */}
      <div className="cap-toolbar">
        <button className="cap-tbtn" onClick={() => setUploaded(false)}><I.chevL size={15} />Cancel</button>
        <button className="cap-tbtn" onClick={reset}><I.refresh size={14} />Reset</button>
        <div className="spacer" />
        <button className="cap-store" onClick={store}>Store</button>
        <button className="cap-tbtn icon"><I.dots size={16} /></button>
      </div>

      {/* Two panes */}
      <div className="cap-panes">
        {/* LEFT — indexing form */}
        <div className="cap-form">
          <CapField label="Document Type"><CapInput value={form.docType} readOnly /></CapField>
          <CapField label="Status"><CapInput value={form.status} readOnly /></CapField>
          <CapField label="XML Status"><CapInput value={form.xmlStatus} readOnly /></CapField>

          <CapField label="Date" hlKey="date" onHl={setHl}>
            <CapDate value={form.date} onChange={v => set('date', v)} active invalid={dateInvalid} />
            {dateInvalid && <div className="cap-err"><I.alert size={12} />Date is more than {MAX_DATE_AGE_MONTHS} months old — not accepted</div>}
          </CapField>
          <CapField label="Due Date">
            <CapDate value={form.dueDate} onChange={v => set('dueDate', v)} />
          </CapField>

          <CapField label="Vendor" hlKey="vendor" onHl={setHl}><CapInput value={form.vendor} onChange={v => set('vendor', v)} chevron /></CapField>
          <CapField label="Amount" hlKey="amount" onHl={setHl}><CapInput value={form.amount} onChange={v => set('amount', v)} chevron /></CapField>
          <CapField label="Purchase Order Number" hlKey="po" onHl={setHl}><CapInput value={form.po} onChange={v => set('po', v)} chevron /></CapField>
          <CapField label="Company Code" hlKey="company" onHl={setHl}><CapInput value={form.companyCode} onChange={v => set('companyCode', v)} chevron /></CapField>
          <CapField label="Invoice Number" hlKey="invNo" onHl={setHl}><CapInput value={form.invoiceNumber} onChange={v => set('invoiceNumber', v)} chevron /></CapField>
          <CapField label="Vendor Reference" hlKey="sapSo" onHl={setHl}><CapInput value={form.vendorRef} onChange={v => set('vendorRef', v)} chevron /></CapField>

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
            <ArdaghInvoice inv={CAP_INVOICE} hl={hl} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CapField({ label, top, hlKey, onHl, children }: {
  label: string; top?: boolean; hlKey?: string; onHl?: (k: string | null) => void; children: React.ReactNode;
}) {
  const handlers = hlKey && onHl ? {
    onMouseEnter: () => onHl(hlKey),
    onMouseLeave: () => onHl(null),
    onFocus: () => onHl(hlKey),
    onBlur: () => onHl(null),
  } : {};
  return (
    <div className={cx('cap-field', top && 'top', hlKey && 'cap-field-hl')} {...handlers}>
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

// Ardagh Metal Packaging invoice facsimile (document viewer)
function ArdaghInvoice({ inv, hl }: { inv: typeof CAP_INVOICE; hl: string | null }) {
  const box: React.CSSProperties = { border: '1px solid #2b6ca3', fontSize: 9.5, lineHeight: 1.45 };
  const hd: React.CSSProperties = { background: '#dce9f3', borderBottom: '1px solid #2b6ca3', padding: '2px 6px', fontSize: 8.5, fontWeight: 700, color: '#1c4e74', letterSpacing: '0.02em' };
  // highlight style for the region matching the focused/hovered field
  const mark = (key: string): React.CSSProperties => hl === key ? {
    background: '#fff3b0', boxShadow: '0 0 0 2px #e6a012', borderRadius: 2,
    transition: 'background .15s, box-shadow .15s',
  } : { transition: 'background .15s, box-shadow .15s' };
  return (
    <div style={{ background: 'white', color: '#1a1a1a', width: 620, minHeight: 800, padding: '26px 30px', boxShadow: 'var(--shadow)', fontSize: 10, fontFamily: 'Arial, sans-serif' }}>
      {/* logo */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#6b7785', letterSpacing: '-0.01em' }}>Ardagh</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#1f6fb2' }}>Metal</span>
        <span style={{ fontSize: 20, fontWeight: 400, color: '#6b7785' }}>Packaging</span>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#1f6fb2', color: 'white', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, marginLeft: 2 }}>MP</span>
      </div>

      {/* shipper / invoice no */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
        <div style={box}>
          <div style={hd}>SHIPPER</div>
          <div style={{ padding: '4px 6px' }}>
            <div style={{ fontWeight: 700, display: 'inline-block', padding: '0 2px', ...mark('vendor') }}>{inv.vendorName}</div>
            {inv.vendorAddr.map((l, i) => <div key={i} style={{ fontWeight: i === 1 ? 700 : 400 }}>{l}</div>)}
          </div>
        </div>
        <div style={box}>
          <div style={hd}>INVOICE N°:&nbsp;&nbsp;<span style={{ padding: '0 2px', ...mark('invNo') }}>{inv.invNo}</span></div>
          <div style={{ padding: '12px 6px', textAlign: 'center', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700 }}>DATE : <span style={{ padding: '0 2px', ...mark('date') }}>{inv.date}</span></div>
            <div style={{ fontWeight: 700 }}>SAP SO N° : <span style={{ padding: '0 2px', ...mark('sapSo') }}>{inv.sapSo}</span></div>
          </div>
        </div>
      </div>

      {/* delivery / invoiced to */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
        <div style={box}>
          <div style={hd}>DELIVERY ADDRESS :</div>
          <div style={{ padding: '4px 6px' }}>{inv.shipTo.map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
        <div style={box}>
          <div style={hd}>INVOICED TO :</div>
          <div style={{ padding: '4px 6px', ...mark('company') }}>{inv.shipTo.map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
      </div>

      {/* shipment from / booking / means */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #2b6ca3', marginBottom: 8 }}>
        {[['SHIPMENT FROM :', inv.shipFrom], ['BOOKING N° :', inv.booking], ['MEANS OF DELIVERY :', inv.delivery]].map((c, i) => (
          <div key={i} style={{ borderRight: i < 2 ? '1px solid #2b6ca3' : 'none' }}>
            <div style={{ ...hd, textAlign: 'center' }}>{c[0]}</div>
            <div style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{c[1]}</div>
          </div>
        ))}
      </div>

      {/* approved exporter */}
      <div style={{ border: '1px solid #2b6ca3', textAlign: 'center', padding: '4px', fontWeight: 700, fontSize: 9, marginBottom: 12 }}>{inv.exporter}</div>

      {/* line items */}
      <div style={{ border: '1px solid #2b6ca3' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 70px 96px 96px', background: '#dce9f3', borderBottom: '1px solid #2b6ca3' }}>
          {['Line', 'Article', 'Quantity', 'Price per 1000 cans', 'Value Total EURO'].map((h, i) => (
            <div key={i} style={{ padding: '4px 6px', fontSize: 8.5, fontWeight: 700, color: '#1c4e74', textAlign: i === 0 || i === 1 ? 'left' : 'right', borderRight: i < 4 ? '1px solid #b9d2e6' : 'none' }}>{h}</div>
          ))}
        </div>
        {inv.lines.map((li, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 70px 96px 96px', minHeight: 70 }}>
            <div style={{ padding: '8px 6px' }}>{li.line}</div>
            <div style={{ padding: '8px 6px' }}>{li.article.map((a, j) => <div key={j} style={{ fontWeight: j === 0 ? 600 : 400, marginBottom: 1 }}>{a}</div>)}</div>
            <div style={{ padding: '8px 6px', textAlign: 'right' }}>{li.qty}</div>
            <div style={{ padding: '8px 6px', textAlign: 'right' }}>{li.price}</div>
            <div style={{ padding: '8px 6px', textAlign: 'right' }}>{li.total}</div>
          </div>
        ))}
      </div>

      {/* incoterm value */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 30, margin: '14px 0' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 600 }}>Value as per incoterm :</div>
          <div>{inv.incoterm}</div>
        </div>
        <div style={{ fontWeight: 700, color: '#c0392b' }}>{inv.incotermValue}</div>
      </div>

      {/* tax text */}
      <div style={{ fontSize: 9, marginBottom: 16 }}>
        <div style={{ fontWeight: 700 }}>TAX EXEMPT EXPORT SUPPLY ACCORDING TO ARTICLE 146 OF THE EU DIRECTIVE 2006/112/EC</div>
        <div style={{ fontWeight: 700 }}>The exporter of the products covered by this document (customs authorization N° FR002730/0122) declares that, except where otherwise clearly indicated, these products are of European Union preferential origin.</div>
      </div>

      {/* shipment */}
      <div style={{ marginBottom: 16, fontSize: 9.5 }}>
        <div style={{ textDecoration: 'underline', fontWeight: 600 }}>Shipment:</div>
        <div style={{ paddingLeft: 90, lineHeight: 1.7 }}>
          <div>3&nbsp;&nbsp;containers</div>
          <div>48&nbsp;&nbsp;pallets of cans</div>
          <div>373 440 CANS 33CL 202 ALUMINIUM</div>
        </div>
        <div style={{ marginTop: 10 }}><b>Total Gross weight :</b>&nbsp;&nbsp;&nbsp;{inv.grossWeight}</div>
        <div><b>Customer ref :</b> <span style={{ padding: '0 2px', ...mark('po') }}>{inv.custRef}</span></div>
      </div>

      {/* payment terms + total */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 8.5, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700 }}>Payment terms: 60 days from invoice date</div>
          <div style={{ fontWeight: 700 }}>Bank: Bank of America Europe DAC</div>
          <div>2 Park Place, Hatch Street, Dublin 2, Ireland</div>
          <div>IBAN: IE77BOFA9906156556017</div>
          <div>SWIFT: BOFAIE3XXXX</div>
        </div>
        <div style={{ display: 'flex', border: '1px solid #2b6ca3', ...mark('amount') }}>
          <div style={{ padding: '5px 10px', fontWeight: 700, fontSize: 9, borderRight: '1px solid #2b6ca3' }}>TOTAL VALUE EURO</div>
          <div style={{ padding: '5px 14px', fontWeight: 700, fontSize: 9, background: hl === 'amount' ? '#fff3b0' : '#bfe0f0' }}>{inv.totalValue}</div>
        </div>
      </div>
    </div>
  );
}
