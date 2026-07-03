/** Short, human-facing display codes for new rows (INV-2026-XXXX, WF-XXXX,
 * DOC-XXXX, EVT-XXXX). Not a sequence — just unique enough for a display key
 * that humans read in the UI; the real primary key is always the row's uuid. */
export function genCode(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export function genInvoiceCode(): string {
  return `INV-${new Date().getFullYear()}-${Math.random().toString().slice(2, 6)}${Date.now().toString().slice(-2)}`;
}
