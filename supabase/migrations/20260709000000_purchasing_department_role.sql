-- Adds "Purchasing Department" as a real invoice_app_users role (previously only a
-- workflow task role/string), so Request Info can route to it directly and
-- admins can actually create such a user.
alter table invoice_app_users drop constraint if exists invoice_app_users_role_check;
alter table invoice_app_users add constraint invoice_app_users_role_check
  check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department'));

alter table invoice_role_permissions drop constraint if exists invoice_role_permissions_role_check;
alter table invoice_role_permissions add constraint invoice_role_permissions_role_check
  check (role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department'));

alter table invoice_approver_mappings drop constraint if exists invoice_approver_mappings_approver_role_check;
alter table invoice_approver_mappings add constraint invoice_approver_mappings_approver_role_check
  check (approver_role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer','Purchasing Department'));

-- Same module access as AP Clerk (works invoices/workflows day to day, no
-- admin/audit access) — a sensible default an admin can adjust in
-- Admin > Roles & Permissions.
insert into invoice_role_permissions (role, module, can_access) values
  ('Purchasing Department', 'dashboard', true), ('Purchasing Department', 'capture', false), ('Purchasing Department', 'invoices', true),
  ('Purchasing Department', 'workflows', true), ('Purchasing Department', 'reports', false), ('Purchasing Department', 'audit', false),
  ('Purchasing Department', 'invoice_notifications', true), ('Purchasing Department', 'admin', false)
on conflict (role, module) do nothing;
