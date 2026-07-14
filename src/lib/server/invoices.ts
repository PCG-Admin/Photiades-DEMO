'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { genInvoiceCode } from '@/lib/server/codes';
import { getCurrentAppUser } from '@/lib/server/users';
import { createWorkflowInstance } from '@/lib/server/workflows';
import { recordAuditEvent } from '@/lib/server/audit';
import { uploadInvoiceDocument, getDocumentUrl } from '@/lib/server/storage';
import { storeInvoiceInDocuWare } from '@/lib/server/docuware';
import type { InvoiceRow, InvoiceLineItemRow, AuditChange } from '@/lib/supabase/types';

export interface InvoiceWithLineItems extends InvoiceRow {
  lineItems: InvoiceLineItemRow[];
  documentUrl: string | null;
}

export async function getInvoices(): Promise<InvoiceRow[]> {
  const { data, error } = await createServiceClient()
    .from('invoices').select('*').order('created_at', { ascending: false })
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

/** Backs the topbar search box — matches on the fields a user would
 * actually type: the invoice/workflow code, vendor name, PO number,
 * invoice number, or vendor reference. Commas/parens are stripped since
 * they're PostgREST's `.or()` filter-syntax separators, not something a
 * search query should be parsed as. */
export async function searchInvoices(query: string): Promise<InvoiceRow[]> {
  const q = query.trim().replace(/[,()]/g, ' ').trim();
  if (q.length < 2) return [];
  const { data, error } = await createServiceClient()
    .from('invoices').select('*')
    .or(`code.ilike.%${q}%,vendor.ilike.%${q}%,invoice_no.ilike.%${q}%,po.ilike.%${q}%,vendor_ref.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(8)
    .overrideTypes<InvoiceRow[], { merge: false }>();
  if (error) throw error;
  return data;
}

export async function getInvoiceByCode(code: string): Promise<InvoiceWithLineItems | null> {
  const supabase = createServiceClient();
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('code', code).single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (error) return null;

  const { data: lineItems, error: liError } = await supabase
    .from('invoice_line_items').select('*').eq('invoice_id', invoice.id).order('seq')
    .overrideTypes<InvoiceLineItemRow[], { merge: false }>();
  if (liError) throw liError;

  const documentUrl = invoice.document_path ? await getDocumentUrl(invoice.document_path) : null;

  return { ...invoice, lineItems, documentUrl };
}

/** Same vendor + same invoice number already on file — the classic AP
 * duplicate-invoice check. Called from Capture right after extraction, so
 * the user can be warned before storing the same document twice. */
export async function findDuplicateInvoice(vendor: string, invoiceNo: string): Promise<InvoiceRow | null> {
  if (!vendor.trim() || !invoiceNo.trim()) return null;
  const { data } = await createServiceClient()
    .from('invoices').select('*')
    .ilike('vendor', vendor.trim())
    .ilike('invoice_no', invoiceNo.trim())
    .limit(1).maybeSingle()
    .overrideTypes<InvoiceRow | null, { merge: false }>();
  return data;
}

/** Exact-file duplicate check — a SHA-256 hash of the uploaded bytes, so it
 * doesn't depend on Gemini extracting identical vendor/invoice-number text
 * on a second pass. Called from Capture immediately on file select, before
 * extraction runs. */
export async function findDuplicateInvoiceByHash(hash: string): Promise<InvoiceRow | null> {
  const { data } = await createServiceClient()
    .from('invoices').select('*').eq('document_hash', hash).limit(1).maybeSingle()
    .overrideTypes<InvoiceRow | null, { merge: false }>();
  return data;
}

/** Deletes the invoice (and, via cascade, its workflow instance/history and
 * line items). Audit/notification rows referencing it are preserved with
 * their invoice link cleared — see supabase/migrations/20260704000000_invoice_delete.sql.
 * The audit event for the deletion itself is recorded before the delete so
 * it still names the invoice's code. */
export async function deleteInvoice(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: invoice, error: fetchError } = await supabase.from('invoices').select('*').eq('id', id).single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (fetchError) throw fetchError;

  await recordAuditEvent({
    action: 'deleted invoice', module: 'Invoices', target: invoice.code, invoiceId: invoice.id,
    icon: 'trash', tone: 'red',
  });

  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

/** Diffs `patch` against the row's current values and calls
 * recordAuditEvent() with the changed fields — SOW §5.7 field-level
 * before/after capture (T150). */
export async function updateInvoiceFields(id: string, patch: Partial<InvoiceRow>): Promise<InvoiceRow> {
  const supabase = createServiceClient();
  const { data: before, error: fetchError } = await supabase.from('invoices').select('*').eq('id', id).single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (fetchError) throw fetchError;

  const changes: AuditChange[] = Object.keys(patch)
    .filter(key => patch[key as keyof InvoiceRow] !== before[key as keyof InvoiceRow])
    .map(key => ({ field: key, before: before[key as keyof InvoiceRow], after: patch[key as keyof InvoiceRow] }));

  const { data: after, error } = await supabase
    .from('invoices').update(patch as never).eq('id', id).select('*').single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (error) throw error;

  if (changes.length > 0) {
    await recordAuditEvent({
      action: 'edited invoice fields',
      module: 'Invoices',
      target: after.code,
      invoiceId: after.id,
      changes,
      icon: 'edit',
      tone: 'amber',
    });
  }
  return after;
}

export interface CaptureStoreInput {
  vendor: string;
  invoiceNo: string;
  date: string;      // ISO date
  dueDate: string;    // ISO date
  po: string | null;
  companyCode: string;
  vendorRef: string;
  stockType: InvoiceRow['stock_type'];
  amount: number;      // total
  lineItems: { description: string; qty: number; unitPrice: number; amount: number; glCode: string | null; item?: string | null; material?: string | null; uom?: string | null }[];
  confidence: number | null;
  documentHash: string | null;
  sapPostingType: string | null;
  sapInvText: string | null;
  invoiceKind: InvoiceRow['invoice_kind'];
  documentNumber: string | null;
}

/** Backs Capture's "Store" button: creates the invoice + line items, uploads
 * the original file to Storage so it can be viewed later, starts its
 * Stock/Non-Stock workflow at task 1, and records the audit event.
 * There's no combined-workflow concept in the SOW, so "Stock &amp; Non Stock"
 * and unset both default to the Non-Stock workflow — documented simplification. */
export async function createInvoiceFromExtraction(input: CaptureStoreInput, file: File | null): Promise<InvoiceRow> {
  const supabase = createServiceClient();
  const currentUser = await getCurrentAppUser();

  const subtotal = input.lineItems.reduce((s, li) => s + li.amount, 0) || input.amount;
  const total = input.amount || subtotal;
  const vat = Math.max(0, total - subtotal);

  const code = genInvoiceCode();
  const documentPath = file ? await uploadInvoiceDocument(file, code) : null;

  const invoiceRow = {
    code,
    vendor: input.vendor,
    po: input.po,
    subtotal,
    vat,
    total,
    currency: 'EUR',
    status: 'Awaiting Approval' as const,
    received_at: input.date,
    due_at: input.dueDate || input.date,
    confidence: input.confidence,
    po_match: null,
    assignee_id: null,
    dept: currentUser.dept,
    flags: [],
    invoice_no: input.invoiceNo,
    priority: null,
    company_code: input.companyCode,
    vendor_ref: input.vendorRef,
    stock_type: input.stockType,
    stock_doc_number: null,
    non_stock_doc_number: null,
    xml_status: 'Pending' as const,
    sap_posting_type: input.sapPostingType || null,
    sap_inv_text: input.sapInvText || null,
    invoice_kind: input.invoiceKind,
    document_number: input.documentNumber || null,
    grn: null,
    facsimile: null,
    extracted_conf: input.confidence != null ? { overall: input.confidence } : null,
    document_path: documentPath,
    document_mime_type: file?.type ?? null,
    document_hash: input.documentHash,
  };
  // `as never` bypasses postgrest-js's insert-argument type resolution,
  // which breaks down to `never` under the project's TypeScript 6.
  const { data: invoice, error } = await supabase
    .from('invoices').insert(invoiceRow as never).select('*').single()
    .overrideTypes<InvoiceRow, { merge: false }>();
  if (error) throw error;

  if (input.lineItems.length > 0) {
    const lineItemRows = input.lineItems.map((li, i) => ({
      invoice_id: invoice.id,
      seq: i + 1,
      description: li.description,
      qty: li.qty,
      unit_price: li.unitPrice,
      amount: li.amount,
      gl_code: li.glCode,
      item: li.item ?? null,
      material: li.material ?? null,
      uom: li.uom ?? null,
    }));
    const { error: liError } = await supabase.from('invoice_line_items').insert(lineItemRows as never);
    if (liError) throw liError;
  }

  const wfId = input.stockType === 'Stock' ? 'stock' : 'nonstock';
  await createWorkflowInstance(invoice.id, wfId, invoice.total);

  await recordAuditEvent({
    action: 'captured invoice',
    module: 'Capture',
    target: invoice.code,
    invoiceId: invoice.id,
    icon: 'upload',
    tone: 'blue',
  });

  // Hands off to DocuWare's own storage + XML-export automation — never
  // blocks/fails the capture itself if the hand-off fails (see
  // storeInvoiceInDocuWare's xml_status update on failure).
  await storeInvoiceInDocuWare(invoice, file);

  return invoice;
}
