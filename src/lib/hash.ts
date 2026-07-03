/** SHA-256 of a file's bytes, as hex — used for exact-file duplicate
 * detection (see src/lib/server/invoices.ts's findDuplicateInvoiceByHash).
 * Runs via the Web Crypto API, so it's fast and never blocks the main
 * thread for the file sizes this app accepts (capped at 15MB). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
