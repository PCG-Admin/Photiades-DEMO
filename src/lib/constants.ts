/* Reference picklists — plain constants, no DB table needed for these.
 * ROLES/STOCK_TYPES mirror the check constraints in
 * supabase/migrations/20260701000000_initial_schema.sql; keep in sync
 * manually if either changes. */

export type StockType = 'Stock' | 'Non-stock' | 'Stock & Non Stock';
export const STOCK_TYPES: StockType[] = ['Stock', 'Non-stock', 'Stock & Non Stock'];
export const COMPANY_CODES = ['1000', '2000', '3000', '4000'];
export const ROLES = ['Administrator', 'AP Manager', 'AP Clerk', 'Approver', 'Auditor', 'Viewer'];
export const DEPTS = ['Finance', 'Operations', 'Procurement', 'Marketing', 'IT', 'Logistics', 'Executive'];

export interface ChainStep {
  role: string;
  name: string;
  action: string;
  when: Date | null;
}
