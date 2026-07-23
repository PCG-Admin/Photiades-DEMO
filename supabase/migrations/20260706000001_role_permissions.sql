-- ---------- invoice_role_permissions (T168 — per-module access per role) ----------
-- Modules here are portal PAGES (matches the sidebar nav keys in
-- src/components/shell/AppShell.tsx), not the invoice_audit_events.module tag set —
-- a different, unrelated vocabulary that just happens to overlap.
create table invoice_role_permissions (
  role text not null check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer')),
  module text not null check (module in ('dashboard','capture','invoices','workflows','reports','audit','invoice_notifications','admin')),
  can_access boolean not null default true,
  primary key (role, module)
);

alter table invoice_role_permissions enable row level security;
-- any authenticated user needs to read this to know their own nav/page access
create policy invoice_role_permissions_select_all on invoice_role_permissions for select using (auth.role() = 'authenticated');
create policy invoice_role_permissions_admin_write on invoice_role_permissions for all
  using (app_is_admin()) with check (app_is_admin());

-- Seed defaults reflecting the descriptions already shown in AdminView's
-- Roles & Permissions tab. Administrators always see every module —
-- enforced in code (src/lib/server/permissions.ts) as a bypass, not by this
-- seed, so an admin can never accidentally lock themselves out via this UI.
insert into invoice_role_permissions (role, module, can_access) values
  ('Administrator', 'dashboard', true), ('Administrator', 'capture', true), ('Administrator', 'invoices', true),
  ('Administrator', 'workflows', true), ('Administrator', 'reports', true), ('Administrator', 'audit', true),
  ('Administrator', 'invoice_notifications', true), ('Administrator', 'admin', true),

  ('AP Manager', 'dashboard', true), ('AP Manager', 'capture', true), ('AP Manager', 'invoices', true),
  ('AP Manager', 'workflows', true), ('AP Manager', 'reports', true), ('AP Manager', 'audit', false),
  ('AP Manager', 'invoice_notifications', true), ('AP Manager', 'admin', false),

  ('AP Clerk', 'dashboard', true), ('AP Clerk', 'capture', true), ('AP Clerk', 'invoices', true),
  ('AP Clerk', 'workflows', true), ('AP Clerk', 'reports', false), ('AP Clerk', 'audit', false),
  ('AP Clerk', 'invoice_notifications', true), ('AP Clerk', 'admin', false),

  ('Approver', 'dashboard', true), ('Approver', 'capture', false), ('Approver', 'invoices', true),
  ('Approver', 'workflows', true), ('Approver', 'reports', false), ('Approver', 'audit', false),
  ('Approver', 'invoice_notifications', true), ('Approver', 'admin', false),

  ('Auditor', 'dashboard', true), ('Auditor', 'capture', false), ('Auditor', 'invoices', false),
  ('Auditor', 'workflows', false), ('Auditor', 'reports', true), ('Auditor', 'audit', true),
  ('Auditor', 'invoice_notifications', true), ('Auditor', 'admin', false),

  ('Viewer', 'dashboard', true), ('Viewer', 'capture', false), ('Viewer', 'invoices', false),
  ('Viewer', 'workflows', false), ('Viewer', 'reports', false), ('Viewer', 'audit', false),
  ('Viewer', 'invoice_notifications', true), ('Viewer', 'admin', false);
