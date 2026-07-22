-- ============================================================
-- Photiades Workflow Portal — consolidated reference schema
--
-- This is a single-file snapshot of the schema after all migrations in
-- supabase/migrations/ are applied, generated for documentation/onboarding
-- and for bootstrapping a fresh Supabase project in one shot. It is NOT
-- itself a migration and is not run by any tooling — supabase/migrations/
-- remains the source of truth and the actual apply history. If you change
-- the schema, add a new timestamped file under migrations/ and update this
-- file to match; don't edit this file as if it were live.
--
-- Workflow task/outcome/field DEFINITIONS (WF_STOCK_TASKS, WF_NONSTOCK_TASKS,
-- WF_SPECIAL_TASKS) are NOT modeled here — they stay as fixed TypeScript
-- business rules in src/lib/workflow.ts. Only workflow INSTANCES and their
-- decision HISTORY are persisted.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- app_settings (configurable approval threshold) ----------
create table app_settings (
  id boolean primary key default true,          -- singleton row pattern
  approval_threshold numeric(14,2) not null default 500.00,
  currency text not null default 'EUR',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint app_settings_singleton check (id)
);
insert into app_settings (id) values (true);

-- ---------- app_users (User Administration directory) ----------
-- No longer FK'd to auth.users(id) — decoupled so Admin can create users
-- freely without a signup flow driving the id.
create table app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role text not null check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department')),
  dept text not null,
  status text not null default 'Active' check (status in ('Active','Inactive')),
  mfa_enabled boolean not null default false,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index app_users_role_idx on app_users(role);
create index app_users_status_idx on app_users(status);

-- security-definer helpers to read the calling user's role without
-- triggering recursive RLS evaluation on app_users
create or replace function app_current_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from app_users where id = auth.uid();
$$;

create or replace function app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'Administrator' from app_users where id = auth.uid()), false);
$$;

alter table app_users enable row level security;
-- any authenticated user can read the directory (needed for assignee
-- pickers, "select user to approve" dropdowns, avatars across the app)
create policy app_users_select_all on app_users for select using (auth.role() = 'authenticated');
-- only Administrators can insert/update/delete other users' rows
create policy app_users_admin_write on app_users for all
  using (app_is_admin()) with check (app_is_admin());

alter table app_settings enable row level security;
create policy app_settings_select_all on app_settings for select using (auth.role() = 'authenticated');
create policy app_settings_admin_write on app_settings for update
  using (app_is_admin()) with check (app_is_admin());

-- ---------- invoices ----------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- e.g. 'INV-2026-1480' (display key, client-generated at Capture)
  vendor text not null,
  po text,
  subtotal numeric(14,2) not null,
  vat numeric(14,2) not null,
  total numeric(14,2) not null,
  currency text not null default 'EUR',
  status text not null check (status in (
    'Awaiting Approval','In Review','Approved','Paid','Exception','Processing',
    'Pending Payment','At AcDep','Order not placed via PD','Paid Invoice','Declined'
  )),
  received_at date not null,
  due_at date not null,
  confidence numeric(5,2),
  po_match text check (po_match in ('Matched','Mismatch','No PO Found')),
  assignee_id uuid references app_users(id),
  dept text not null,
  flags text[] not null default '{}',
  invoice_no text not null,
  priority text,
  company_code text not null,
  vendor_ref text not null,
  stock_type text check (stock_type in ('Stock','Non-stock','Stock & Non Stock')),  -- nullable: Gemini extraction can legitimately return no guess
  stock_doc_number text,
  non_stock_doc_number text,
  xml_status text not null default 'Pending' check (xml_status in ('Pending','Exported','Failed')),
  grn text,
  facsimile jsonb,                                  -- render-stable extraction-preview fields
  extracted_conf jsonb,                              -- per-field OCR confidence map
  document_path text,                                -- Storage object path (invoice-documents bucket)
  document_mime_type text,
  document_hash text,                                -- client-computed SHA-256 of the uploaded file, for exact-duplicate detection
  sap_posting_type text,
  sap_inv_text text,
  invoice_kind text not null default 'Standard' check (invoice_kind in ('Standard', 'Special')),
  document_number text,                              -- Special Invoice's own document number (not extracted by Gemini)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_status_idx on invoices(status);
create index invoices_assignee_idx on invoices(assignee_id);
create index invoices_vendor_idx on invoices(vendor);
create index invoices_stock_type_idx on invoices(stock_type);
create index invoices_received_idx on invoices(received_at desc);
create index invoices_vendor_invoice_no_idx on invoices(lower(vendor), lower(invoice_no));
create index invoices_document_hash_idx on invoices(document_hash);

-- Special Invoice's Material Code table reuses this table instead of a
-- parallel one — description/amount already fit "Description"/"Total";
-- item/material/uom are Special-only columns, null for Standard invoices.
create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  seq int not null,
  description text not null,
  qty numeric(12,2) not null,
  unit_price numeric(14,4) not null,
  amount numeric(14,2) not null,
  gl_code text,
  item text,
  material text,
  uom text,
  unique (invoice_id, seq)
);
create index invoice_line_items_invoice_idx on invoice_line_items(invoice_id);

alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
-- read: any authenticated user (Viewer role included, read-only persona)
create policy invoices_select_all on invoices for select using (auth.role() = 'authenticated');
create policy invoice_line_items_select_all on invoice_line_items for select using (auth.role() = 'authenticated');
-- write: AP Clerk/AP Manager/Administrator can insert; nobody deletes via RLS (delete goes through the service-role client)
create policy invoices_insert on invoices for insert with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));
create policy invoices_update on invoices for update using (app_current_role() in ('AP Clerk','AP Manager','Administrator','Approver'))
  with check (app_current_role() in ('AP Clerk','AP Manager','Administrator','Approver'));
create policy invoice_line_items_insert on invoice_line_items for insert with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));
create policy invoice_line_items_update on invoice_line_items for update using (app_current_role() in ('AP Clerk','AP Manager','Administrator'));

-- ---------- documents (Capture queue) ----------
create table documents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                        -- e.g. 'DOC-90210'
  name text not null,
  type text not null check (type in ('Invoice','Purchase Order','Delivery Note','Contract','Receipt','Statement','Credit Note')),
  type_confidence numeric(5,2),
  status text not null check (status in ('Queued','Scanned','Classifying','Extracting','Verified','Exception')),
  source text not null,
  pages int not null default 1,
  size_label text,
  progress int not null default 0 check (progress between 0 and 100),
  invoice_id uuid references invoices(id) on delete set null,   -- set once a document resolves to an invoice
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index documents_status_idx on documents(status);
create index documents_invoice_idx on documents(invoice_id);

alter table documents enable row level security;
create policy documents_select_all on documents for select using (auth.role() = 'authenticated');
create policy documents_insert on documents for insert with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));
create policy documents_update on documents for update using (app_current_role() in ('AP Clerk','AP Manager','Administrator'))
  with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));

-- ---------- workflow_instances (Stock / Non-Stock / Special approval chains) ----------
-- wf_id + task_idx are looked up against the fixed WF_STOCK_TASKS /
-- WF_NONSTOCK_TASKS / WF_SPECIAL_TASKS TypeScript arrays at the application
-- layer — no task-definition table.
create table workflow_instances (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                         -- e.g. 'WF-3400'
  wf_id text not null check (wf_id in ('stock', 'nonstock', 'special')),
  invoice_id uuid not null references invoices(id) on delete cascade,
  task_idx int not null default 0,
  status text not null check (status in ('In Progress','Info Requested','Declined','Completed','Pending Payment','Order not placed via PD')),
  assignee_role text not null,                        -- role required at the current task (drives inbox filtering) — a free-text WFTask.role string, not constrained to app_users.role
  assignee_id uuid references app_users(id),           -- optional named assignee (e.g. "Additional Approval")
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  return_task_idx int,                                 -- where to resume after "Request Info" is resolved, instead of restarting the chain
  unique (invoice_id, wf_id)                            -- one active workflow per invoice per workflow type
);
create index workflow_instances_status_idx on workflow_instances(status);
create index workflow_instances_wfid_idx on workflow_instances(wf_id);
create index workflow_instances_invoice_idx on workflow_instances(invoice_id);
create index workflow_instances_assignee_role_idx on workflow_instances(assignee_role);

create table workflow_history (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references workflow_instances(id) on delete cascade,
  task_id text not null,                              -- WFTask.id, e.g. 't2' / 'n5' / 'sp3'
  task_name text not null,                            -- snapshot of WFTask.name at action time
  action_key text not null,                           -- WFAction.key, e.g. 'approved' / 'requestInfo'
  action_label text not null,
  actor_id uuid references app_users(id),
  actor_name text not null,                            -- snapshot (survives user deletion)
  fields jsonb not null default '{}',                 -- captured WFField values submitted with the action
  occurred_at timestamptz not null default now()
);
create index workflow_history_instance_idx on workflow_history(instance_id, occurred_at);

alter table workflow_instances enable row level security;
alter table workflow_history enable row level security;
create policy workflow_instances_select_all on workflow_instances for select using (auth.role() = 'authenticated');
create policy workflow_history_select_all on workflow_history for select using (auth.role() = 'authenticated');
-- Fine-grained "is this the right role/assignee for this specific task"
-- authorization is data-dependent (varies per task) and enforced in the
-- Server Action layer (requireRole/assertCanActOnTask in
-- src/lib/server/*.ts), not in SQL — RLS here is a coarse backstop only.
create policy workflow_instances_write on workflow_instances for all
  using (app_current_role() <> 'Viewer') with check (app_current_role() <> 'Viewer');
create policy workflow_history_insert on workflow_history for insert with check (app_current_role() <> 'Viewer');

-- ---------- audit_events (immutable action log) ----------
create table audit_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                          -- e.g. 'EVT-500000'
  actor_id uuid references app_users(id),
  actor_name text not null,
  actor_role text not null,
  action text not null,
  icon text,
  tone text,
  target text,                                        -- free-text reference (invoice code, document name, user name, report name)
  module text not null check (module in ('Invoices','Capture','Approvals','Admin','Reports','Auth','Workflows')),
  ip text,
  invoice_id uuid references invoices(id) on delete set null,
  changes jsonb,                                       -- field-level before/after diff, when applicable
  occurred_at timestamptz not null default now()
);
create index audit_events_module_idx on audit_events(module);
create index audit_events_occurred_idx on audit_events(occurred_at desc);
create index audit_events_actor_idx on audit_events(actor_id);
create index audit_events_invoice_idx on audit_events(invoice_id);

alter table audit_events enable row level security;
-- Read-all for authenticated users (UI role-gates the Audit view);
-- append-only — no update/delete policy exists.
create policy audit_events_select_all on audit_events for select using (auth.role() = 'authenticated');
create policy audit_events_insert on audit_events for insert with check (auth.role() = 'authenticated');

-- ---------- notifications (in-app task alerts) ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null check (kind in ('task','sla','declined','system')),
  title text not null,
  detail text,
  icon text,
  tone text,
  ref_invoice_id uuid references invoices(id) on delete set null,
  ref_instance_id uuid references workflow_instances(id),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications(user_id, read);
create index notifications_created_idx on notifications(created_at desc);

alter table notifications enable row level security;
-- strictly per-user: you only ever see/mark your own notifications
create policy notifications_own_select on notifications for select using (user_id = auth.uid());
create policy notifications_own_update on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- inserts happen server-side (system-generated fan-out on workflow events)
create policy notifications_insert on notifications for insert with check (auth.role() = 'authenticated');

-- ---------- role_permissions (per-module page access per role) ----------
-- Modules here are portal PAGES (matches the sidebar nav keys in
-- src/components/shell/AppShell.tsx), not the audit_events.module tag set —
-- a different, unrelated vocabulary that just happens to overlap.
create table role_permissions (
  role text not null check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department')),
  module text not null check (module in ('dashboard','capture','invoices','workflows','reports','audit','notifications','admin')),
  can_access boolean not null default true,
  primary key (role, module)
);

alter table role_permissions enable row level security;
-- any authenticated user needs to read this to know their own nav/page access
create policy role_permissions_select_all on role_permissions for select using (auth.role() = 'authenticated');
create policy role_permissions_admin_write on role_permissions for all
  using (app_is_admin()) with check (app_is_admin());

-- Seed defaults. Administrators always see every module — enforced in code
-- (src/lib/server/permissions.ts) as a bypass, not by this seed, so an admin
-- can never accidentally lock themselves out via the Roles & Permissions UI.
insert into role_permissions (role, module, can_access) values
  ('Administrator', 'dashboard', true), ('Administrator', 'capture', true), ('Administrator', 'invoices', true),
  ('Administrator', 'workflows', true), ('Administrator', 'reports', true), ('Administrator', 'audit', true),
  ('Administrator', 'notifications', true), ('Administrator', 'admin', true),

  ('AP Manager', 'dashboard', true), ('AP Manager', 'capture', true), ('AP Manager', 'invoices', true),
  ('AP Manager', 'workflows', true), ('AP Manager', 'reports', true), ('AP Manager', 'audit', false),
  ('AP Manager', 'notifications', true), ('AP Manager', 'admin', false),

  ('AP Clerk', 'dashboard', true), ('AP Clerk', 'capture', true), ('AP Clerk', 'invoices', true),
  ('AP Clerk', 'workflows', true), ('AP Clerk', 'reports', false), ('AP Clerk', 'audit', false),
  ('AP Clerk', 'notifications', true), ('AP Clerk', 'admin', false),

  ('Approver', 'dashboard', true), ('Approver', 'capture', false), ('Approver', 'invoices', true),
  ('Approver', 'workflows', true), ('Approver', 'reports', false), ('Approver', 'audit', false),
  ('Approver', 'notifications', true), ('Approver', 'admin', false),

  ('Auditor', 'dashboard', true), ('Auditor', 'capture', false), ('Auditor', 'invoices', false),
  ('Auditor', 'workflows', false), ('Auditor', 'reports', true), ('Auditor', 'audit', true),
  ('Auditor', 'notifications', true), ('Auditor', 'admin', false),

  ('Viewer', 'dashboard', true), ('Viewer', 'capture', false), ('Viewer', 'invoices', false),
  ('Viewer', 'workflows', false), ('Viewer', 'reports', false), ('Viewer', 'audit', false),
  ('Viewer', 'notifications', true), ('Viewer', 'admin', false),

  -- Same module access as AP Clerk (works invoices/workflows day to day, no
  -- admin/audit access) — a sensible default an admin can adjust later.
  ('Purchasing Department', 'dashboard', true), ('Purchasing Department', 'capture', false), ('Purchasing Department', 'invoices', true),
  ('Purchasing Department', 'workflows', true), ('Purchasing Department', 'reports', false), ('Purchasing Department', 'audit', false),
  ('Purchasing Department', 'notifications', true), ('Purchasing Department', 'admin', false);

-- ---------- approver_mappings (per-task approver routing by amount) ----------
-- Extends the single global app_settings.approval_threshold with a
-- configurable table: for a given workflow task, route to a specific role
-- and/or approver when the invoice amount falls in [min_amount, max_amount].
-- Falls back to the task's fixed WFTask.role (src/lib/workflow.ts) when no
-- mapping matches — workflows keep working unmodified with no mappings set.
create table approver_mappings (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  min_amount numeric(14,2),
  max_amount numeric(14,2),
  approver_role text not null check (approver_role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department')),
  approver_user_id uuid references app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint approver_mappings_range_valid check (min_amount is null or max_amount is null or min_amount <= max_amount)
);
create index approver_mappings_task_idx on approver_mappings(task_id);

alter table approver_mappings enable row level security;
create policy approver_mappings_select_all on approver_mappings for select using (auth.role() = 'authenticated');
create policy approver_mappings_admin_write on approver_mappings for all
  using (app_is_admin()) with check (app_is_admin());

-- ---------- delegations (out-of-office backup approver) ----------
create table delegations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  backup_user_id uuid not null references app_users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint delegations_valid_range check (start_date <= end_date),
  constraint delegations_not_self check (user_id <> backup_user_id)
);
create index delegations_user_idx on delegations(user_id);
create index delegations_backup_idx on delegations(backup_user_id);

alter table delegations enable row level security;
create policy delegations_select on delegations for select
  using (user_id = auth.uid() or backup_user_id = auth.uid() or app_is_admin());
create policy delegations_write on delegations for all
  using (user_id = auth.uid() or app_is_admin()) with check (user_id = auth.uid() or app_is_admin());

-- ---------- storage: invoice-documents bucket ----------
-- Persists the original uploaded document (PDF/image) so it can be viewed
-- later from the Invoice Processing screen.
insert into storage.buckets (id, name, public)
values ('invoice-documents', 'invoice-documents', false)
on conflict (id) do nothing;

create policy "Authenticated read invoice-documents" on storage.objects
  for select using (bucket_id = 'invoice-documents' and auth.role() = 'authenticated');
create policy "Authenticated write invoice-documents" on storage.objects
  for insert with check (bucket_id = 'invoice-documents' and auth.role() = 'authenticated');
