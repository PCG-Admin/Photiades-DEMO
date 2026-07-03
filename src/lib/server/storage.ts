'use server';

import { createServiceClient } from '@/lib/supabase/service';

const BUCKET = 'invoice-documents';

/** Uploads the original captured document (PDF/image) so it can be viewed
 * later from Invoice Processing — previously only the extracted data was
 * saved, not the file itself. Returns the storage path to save on the
 * invoice row. */
export async function uploadInvoiceDocument(file: File, invoiceCode: string): Promise<string> {
  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
  const path = `${invoiceCode}${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await createServiceClient().storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

/** Signed URLs since the bucket is private — valid for an hour, generated
 * fresh each time the invoice detail is opened. */
export async function getDocumentUrl(path: string): Promise<string | null> {
  const { data, error } = await createServiceClient().storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
