'use server';

import { createServiceClient } from '@/lib/supabase/service';
import type { InvoiceRow } from '@/lib/supabase/types';

/** Posts the captured invoice (file + index fields) to the "Store to
 * DocuWare" Make.com scenario, which stores it into the Dev Environment
 * file cabinet via DocuWare's "Store to File Cabinet" module — that store
 * event is what fires DocuWare's own existing "Index change" automation
 * (Search → Create XML → Store → Update Index Fields → Exported), which is
 * already built and confirmed working. This function only performs the
 * hand-off; it has no visibility into whether that downstream automation
 * later succeeds.
 *
 * Field names match what's confirmed from real DocuWare index data
 * (SCREAMING_SNAKE_CASE) — see the "Dev - XML Create" scenario's webhook
 * trigger bubbles. `COMMENT` is intentionally omitted: Special Invoice's
 * Comment field isn't persisted on `invoices` yet, so there's nothing real
 * to send for it.
 *
 * Never throws — capture shouldn't fail if this hand-off fails.
 * `xml_status` stays 'Pending' (its value at insert) on success, since
 * DocuWare's own automation is what eventually marks it 'Exported'; it
 * only gets flipped to 'Failed' here if the hand-off itself didn't work. */
export async function storeInvoiceInDocuWare(invoice: InvoiceRow, file: File | null): Promise<void> {
  const webhookUrl = process.env.DOCUWARE_STORE_WEBHOOK_URL;
  if (!webhookUrl || !file) {
    await createServiceClient().from('invoices').update({ xml_status: 'Failed' } as never).eq('id', invoice.id);
    return;
  }

  try {
    const body = new FormData();
    body.set('file', file, file.name);
    body.set('DOCUMENT_TYPE', 'Invoice');
    body.set('INVOICE_NUMBER', invoice.invoice_no);
    body.set('COMPANY_CODE', invoice.company_code);
    body.set('DATE', invoice.received_at);
    body.set('DUE_DATE', invoice.due_at);
    body.set('AMOUNT', String(invoice.total));
    body.set('VENDOR', invoice.vendor);
    body.set('PURCHASE_ORDER_NUMBER', invoice.po ?? '');
    body.set('GOODS_RECEIPT_NUMBER', invoice.grn ?? '');
    body.set('VENDOR_REFERENCE', invoice.vendor_ref);
    body.set('STOCK___NON_STOCK', invoice.stock_type ?? '');
    body.set('SAP_INV_TEXT', invoice.sap_inv_text ?? '');
    body.set('SAP_POSTING_TYPE_', invoice.sap_posting_type ?? '');
    body.set('DOCUMENT_NUMBER', invoice.document_number ?? '');
    body.set('XML_STATUS', 'New');

    const res = await fetch(webhookUrl, { method: 'POST', body });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
  } catch {
    await createServiceClient().from('invoices').update({ xml_status: 'Failed' } as never).eq('id', invoice.id);
  }
}
