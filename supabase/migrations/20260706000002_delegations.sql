-- ---------- delegations (T170 — out-of-office backup approver) ----------
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
