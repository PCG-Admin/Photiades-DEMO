-- ---------- invoice_approver_mappings (per-task approver routing by amount) ----------
-- Extends the single global invoice_app_settings.approval_threshold with a
-- configurable table: for a given workflow task, route to a specific
-- role and/or approver when the invoice amount falls in [min_amount,
-- max_amount]. Falls back to the task's fixed WFTask.role (src/lib/workflow.ts)
-- when no mapping matches — existing workflows keep working unmodified.
create table invoice_approver_mappings (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  min_amount numeric(14,2),
  max_amount numeric(14,2),
  approver_role text not null check (approver_role in ('Administrator','AP Manager','AP Clerk','Approver','Auditor','Viewer')),
  approver_user_id uuid references invoice_app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invoice_approver_mappings_range_valid check (min_amount is null or max_amount is null or min_amount <= max_amount)
);
create index invoice_approver_mappings_task_idx on invoice_approver_mappings(task_id);

alter table invoice_approver_mappings enable row level security;
create policy invoice_approver_mappings_select_all on invoice_approver_mappings for select using (auth.role() = 'authenticated');
create policy invoice_approver_mappings_admin_write on invoice_approver_mappings for all
  using (app_is_admin()) with check (app_is_admin());
