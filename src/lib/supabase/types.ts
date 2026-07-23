/* Hand-authored Database type matching supabase/migrations/20260701000000_initial_schema.sql.
 *
 * Replace this file's contents with the real generated types once the
 * Supabase project is live:
 *   npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface AppSettingsRow {
  id: boolean;
  approval_threshold: number;
  currency: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AppUserRow {
  id: string;
  name: string;
  email: string;
  role: 'Administrator' | 'AP Manager' | 'AP Clerk' | 'Approver' | 'Auditor' | 'Viewer' | 'Purchasing Department';
  dept: string;
  status: 'Active' | 'Inactive';
  mfa_enabled: boolean;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: string;
  code: string;
  vendor: string;
  po: string | null;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  status: string;
  received_at: string;
  due_at: string;
  confidence: number | null;
  po_match: 'Matched' | 'Mismatch' | 'No PO Found' | null;
  assignee_id: string | null;
  dept: string;
  flags: string[];
  invoice_no: string;
  priority: string | null;
  company_code: string;
  vendor_ref: string;
  stock_type: 'Stock' | 'Non-stock' | 'Stock & Non Stock' | null;
  stock_doc_number: string | null;
  non_stock_doc_number: string | null;
  xml_status: 'Pending' | 'Exported' | 'Failed';
  sap_posting_type: string | null;
  sap_inv_text: string | null;
  invoice_kind: 'Standard' | 'Special';
  document_number: string | null;
  grn: string | null;
  facsimile: Json | null;
  extracted_conf: Json | null;
  document_path: string | null;
  document_mime_type: string | null;
  document_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItemRow {
  id: string;
  invoice_id: string;
  seq: number;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  gl_code: string | null;
  // Special Invoice's Material Code table reuses this table instead of a
  // parallel one — description/amount already fit Description/Total.
  item: string | null;
  material: string | null;
  uom: string | null;
}

export interface DocumentRow {
  id: string;
  code: string;
  name: string;
  type: 'Invoice' | 'Purchase Order' | 'Delivery Note' | 'Contract' | 'Receipt' | 'Statement' | 'Credit Note';
  type_confidence: number | null;
  status: 'Queued' | 'Scanned' | 'Classifying' | 'Extracting' | 'Verified' | 'Exception';
  source: string;
  pages: number;
  size_label: string | null;
  progress: number;
  invoice_id: string | null;
  received_at: string;
  created_at: string;
}

export interface WorkflowInstanceRow {
  id: string;
  code: string;
  wf_id: 'stock' | 'nonstock' | 'special';
  invoice_id: string;
  task_idx: number;
  status: 'In Progress' | 'Info Requested' | 'Declined' | 'Completed' | 'Pending Payment' | 'Order not placed via PD';
  assignee_role: string;
  assignee_id: string | null;
  started_at: string;
  updated_at: string;
}

export interface WorkflowHistoryRow {
  id: string;
  instance_id: string;
  task_id: string;
  task_name: string;
  action_key: string;
  action_label: string;
  actor_id: string | null;
  actor_name: string;
  fields: Json;
  occurred_at: string;
}

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditEventRow {
  id: string;
  code: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  icon: string | null;
  tone: string | null;
  target: string | null;
  module: 'Invoices' | 'Capture' | 'Approvals' | 'Admin' | 'Reports' | 'Auth' | 'Workflows';
  ip: string | null;
  invoice_id: string | null;
  changes: AuditChange[] | null;
  occurred_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: 'task' | 'sla' | 'declined' | 'system';
  title: string;
  detail: string | null;
  icon: string | null;
  tone: string | null;
  ref_invoice_id: string | null;
  ref_instance_id: string | null;
  read: boolean;
  created_at: string;
}

export interface ApproverMappingRow {
  id: string;
  task_id: string;
  min_amount: number | null;
  max_amount: number | null;
  approver_role: AppUserRow['role'];
  approver_user_id: string | null;
  created_at: string;
}

export type PortalModule = 'dashboard' | 'capture' | 'invoices' | 'workflows' | 'reports' | 'audit' | 'notifications' | 'admin';

export interface RolePermissionRow {
  role: AppUserRow['role'];
  module: PortalModule;
  can_access: boolean;
}

export interface DelegationRow {
  id: string;
  user_id: string;
  backup_user_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      invoice_app_settings: { Row: AppSettingsRow; Insert: Partial<AppSettingsRow>; Update: Partial<AppSettingsRow>; Relationships: [] };
      invoice_app_users: { Row: AppUserRow; Insert: Omit<AppUserRow, 'created_at' | 'updated_at'> & Partial<Pick<AppUserRow, 'created_at' | 'updated_at'>>; Update: Partial<AppUserRow>; Relationships: [] };
      invoices: { Row: InvoiceRow; Insert: Omit<InvoiceRow, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<InvoiceRow, 'id' | 'created_at' | 'updated_at'>>; Update: Partial<InvoiceRow>; Relationships: [] };
      invoice_line_items: { Row: InvoiceLineItemRow; Insert: Omit<InvoiceLineItemRow, 'id'> & Partial<Pick<InvoiceLineItemRow, 'id'>>; Update: Partial<InvoiceLineItemRow>; Relationships: [] };
      invoice_documents: { Row: DocumentRow; Insert: Omit<DocumentRow, 'id' | 'created_at'> & Partial<Pick<DocumentRow, 'id' | 'created_at'>>; Update: Partial<DocumentRow>; Relationships: [] };
      invoice_workflow_instances: { Row: WorkflowInstanceRow; Insert: Omit<WorkflowInstanceRow, 'id' | 'started_at' | 'updated_at'> & Partial<Pick<WorkflowInstanceRow, 'id' | 'started_at' | 'updated_at'>>; Update: Partial<WorkflowInstanceRow>; Relationships: [] };
      invoice_workflow_history: { Row: WorkflowHistoryRow; Insert: Omit<WorkflowHistoryRow, 'id' | 'occurred_at'> & Partial<Pick<WorkflowHistoryRow, 'id' | 'occurred_at'>>; Update: Partial<WorkflowHistoryRow>; Relationships: [] };
      invoice_audit_events: { Row: AuditEventRow; Insert: Omit<AuditEventRow, 'id' | 'occurred_at' | 'invoice_id' | 'changes'> & Partial<Pick<AuditEventRow, 'id' | 'occurred_at' | 'invoice_id' | 'changes'>>; Update: Partial<AuditEventRow>; Relationships: [] };
      invoice_notifications: { Row: NotificationRow; Insert: Omit<NotificationRow, 'id' | 'created_at'> & Partial<Pick<NotificationRow, 'id' | 'created_at'>>; Update: Partial<NotificationRow>; Relationships: [] };
      invoice_approver_mappings: { Row: ApproverMappingRow; Insert: Omit<ApproverMappingRow, 'id' | 'created_at'> & Partial<Pick<ApproverMappingRow, 'id' | 'created_at'>>; Update: Partial<ApproverMappingRow>; Relationships: [] };
      invoice_role_permissions: { Row: RolePermissionRow; Insert: RolePermissionRow; Update: Partial<RolePermissionRow>; Relationships: [] };
      invoice_delegations: { Row: DelegationRow; Insert: Omit<DelegationRow, 'id' | 'created_at'> & Partial<Pick<DelegationRow, 'id' | 'created_at'>>; Update: Partial<DelegationRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
