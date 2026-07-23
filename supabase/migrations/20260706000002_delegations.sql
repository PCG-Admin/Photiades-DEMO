-- ---------- invoice_delegations (T170 — out-of-office backup approver) ----------
create table invoice_delegations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references invoice_app_users(id) on delete cascade,
  backup_user_id uuid not null references invoice_app_users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  constraint invoice_delegations_valid_range check (start_date <= end_date),
  constraint invoice_delegations_not_self check (user_id <> backup_user_id)
);
create index invoice_delegations_user_idx on invoice_delegations(user_id);
create index invoice_delegations_backup_idx on invoice_delegations(backup_user_id);

alter table invoice_delegations enable row level security;
create policy invoice_delegations_select on invoice_delegations for select
  using (user_id = auth.uid() or backup_user_id = auth.uid() or app_is_admin());
create policy invoice_delegations_write on invoice_delegations for all
  using (user_id = auth.uid() or app_is_admin()) with check (user_id = auth.uid() or app_is_admin());
