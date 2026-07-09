/* Reference picklists — plain constants, no DB table needed for these.
 * ROLES/STOCK_TYPES mirror the check constraints in
 * supabase/migrations/20260701000000_initial_schema.sql; keep in sync
 * manually if either changes. */

export type StockType = 'Stock' | 'Non-stock' | 'Stock & Non Stock';
export const STOCK_TYPES: StockType[] = ['Stock', 'Non-stock', 'Stock & Non Stock'];
export const COMPANY_CODES = ['1000', '2000', '3000', '4000'];
export const ROLES = ['Administrator', 'AP Manager', 'AP Clerk', 'Approver', 'Auditor', 'Viewer', 'Purchasing Department'];
export const DEPTS = ['Finance', 'Operations', 'Procurement', 'Marketing', 'IT', 'Logistics', 'Executive'];

export interface ChainStep {
  role: string;
  name: string;
  action: string;
  when: Date | null;
}

// Plausible non-stock service-entry document numbers to offer in the
// dropdown, per SOW §5.2 (Non-Stock Document Number: Dropdown). Shared
// between CaptureView and InvoicesView so both render the same picklist.
export function nonStockDocOptions(current: string): string[] {
  const opts = new Set(['', 'SES-5100023891', 'SES-5100031204', 'SES-5100048822']);
  if (current) opts.add(current);
  return Array.from(opts);
}
