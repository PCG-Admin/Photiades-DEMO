'use server';

import { extractInvoiceFromFile, type ExtractedInvoice } from '@/lib/gemini/extract';
import { ACCEPTED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@/lib/uploadConstraints';

export type ExtractionResult =
  | { ok: true; data: ExtractedInvoice }
  | { ok: false; error: string };

/** Server Action — called directly from CaptureView with the uploaded File. */
export async function extractDocument(file: File): Promise<ExtractionResult> {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
    return { ok: false, error: `Unsupported file type "${file.type}". Upload a PDF, PNG, JPG, WEBP, or HEIC.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: 'File is too large (max 15 MB).' };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const data = await extractInvoiceFromFile(bytes, file.type);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Extraction failed.' };
  }
}
