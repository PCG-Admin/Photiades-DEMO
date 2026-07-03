-- ============================================================
-- Photiades Workflow Portal — initial schema
-- Maps to SOW modules: §5.1 Capture, §5.2 Invoices, §5.3/5.4
-- Stock/Non-Stock workflows, §5.8 User Administration, §6 Audit,
-- §4 Notifications, §12 configurable approval threshold.
--
-- Workflow task/outcome/field DEFINITIONS (WF_STOCK_TASKS,
-- WF_NONSTOCK_TASKS) are NOT modeled here — they stay as fixed
-- TypeScript business rules in src/lib/workflow.ts. Only workflow
-- INSTANCES and their decision HISTORY are persisted.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- app_settings (SOW §12 — configurable €500 threshold) ----------
create table app_settings (
  id boolean primary key default true,          -- singleton row pattern
  approval_threshold numeric(14,2) not null default 500.00,
  currency text not null default 'EUR',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint app_settings_singleton check (id)
);
insert into app_settings (id) values (true);

-- ---------- app_users (SOW §5.8 User Administration) ----------
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer')),
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

-- ---------- invoices (SOW §5.2 Invoice Data Fields) ----------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- e.g. 'INV-2026-1480' (display key)
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
  stock_type text not null check (stock_type in ('Stock','Non-stock','Stock & Non Stock')),
  stock_doc_number text,
  non_stock_doc_number text,
  xml_status text not null default 'Pending' check (xml_status in ('Pending','Exported','Failed')),
  grn text,
  facsimile jsonb,                                  -- render-stable extraction-preview fields
  extracted_conf jsonb,                              -- per-field OCR confidence map
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_status_idx on invoices(status);
create index invoices_assignee_idx on invoices(assignee_id);
create index invoices_vendor_idx on invoices(vendor);
create index invoices_stock_type_idx on invoices(stock_type);
create index invoices_received_idx on invoices(received_at desc);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  seq int not null,
  description text not null,
  qty numeric(12,2) not null,
  unit_price numeric(14,4) not null,
  amount numeric(14,2) not null,
  gl_code text,
  unique (invoice_id, seq)
);
create index invoice_line_items_invoice_idx on invoice_line_items(invoice_id);

alter table invoices enable row level security;
alter table invoice_line_items enable row level security;
-- read: any authenticated user (Viewer role included, per SOW read-only viewer persona)
create policy invoices_select_all on invoices for select using (auth.role() = 'authenticated');
create policy invoice_line_items_select_all on invoice_line_items for select using (auth.role() = 'authenticated');
-- write: AP Clerk/AP Manager/Administrator can insert; nobody deletes (soft-delete not modeled)
create policy invoices_insert on invoices for insert with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));
create policy invoices_update on invoices for update using (app_current_role() in ('AP Clerk','AP Manager','Administrator','Approver'))
  with check (app_current_role() in ('AP Clerk','AP Manager','Administrator','Approver'));
create policy invoice_line_items_insert on invoice_line_items for insert with check (app_current_role() in ('AP Clerk','AP Manager','Administrator'));
create policy invoice_line_items_update on invoice_line_items for update using (app_current_role() in ('AP Clerk','AP Manager','Administrator'));

-- ---------- documents (SOW §5.1 Capture queue) ----------
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
  invoice_id uuid references invoices(id),          -- set once a document resolves to an invoice
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

-- ---------- workflow_instances (SOW §5.3/§5.4 — Stock 7 tasks / Non-Stock 8 tasks) ----------
-- wf_id + task_idx are looked up against the fixed WF_STOCK_TASKS /
-- WF_NONSTOCK_TASKS TypeScript arrays at the application layer — no
-- task-definition table.
create table workflow_instances (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                         -- e.g. 'WF-3400'
  wf_id text not null check (wf_id in ('stock','nonstock')),
  invoice_id uuid not null references invoices(id),
  task_idx int not null default 0,
  status text not null check (status in ('In Progress','Info Requested','Declined','Completed','Pending Payment','Order not placed via PD')),
  assignee_role text not null,                        -- role required at the current task (drives inbox filtering)
  assignee_id uuid references app_users(id),           -- optional named assignee (e.g. "Additional Approval")
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, wf_id)                            -- one active workflow per invoice per workflow type
);
create index workflow_instances_status_idx on workflow_instances(status);
create index workflow_instances_wfid_idx on workflow_instances(wf_id);
create index workflow_instances_invoice_idx on workflow_instances(invoice_id);
create index workflow_instances_assignee_role_idx on workflow_instances(assignee_role);

create table workflow_history (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references workflow_instances(id) on delete cascade,
  task_id text not null,                              -- WFTask.id, e.g. 't2' / 'n5'
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
-- Fine-grained "is this the right role for this specific task" authorization
-- is data-dependent (varies per task) and enforced in the Server Action
-- layer, not in SQL (it would require duplicating the WFTask table into the
-- DB, which is out of scope). RLS here is a coarse backstop only.
create policy workflow_instances_write on workflow_instances for all
  using (app_current_role() <> 'Viewer') with check (app_current_role() <> 'Viewer');
create policy workflow_history_insert on workflow_history for insert with check (app_current_role() <> 'Viewer');

-- ---------- audit_events (SOW §6 Audit) ----------
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
  occurred_at timestamptz not null default now()
);
create index audit_events_module_idx on audit_events(module);
create index audit_events_occurred_idx on audit_events(occurred_at desc);
create index audit_events_actor_idx on audit_events(actor_id);

alter table audit_events enable row level security;
-- Kept simple this pass: read-all for authenticated users, UI role-gates
-- the Audit view; inserts are append-only (no update/delete policy exists).
create policy audit_events_select_all on audit_events for select using (auth.role() = 'authenticated');
create policy audit_events_insert on audit_events for insert with check (auth.role() = 'authenticated');

-- ---------- notifications (SOW §4 — Email / in-app task alerts) ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  kind text not null check (kind in ('task','sla','declined','system')),
  title text not null,
  detail text,
  icon text,
  tone text,
  ref_invoice_id uuid references invoices(id),
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
