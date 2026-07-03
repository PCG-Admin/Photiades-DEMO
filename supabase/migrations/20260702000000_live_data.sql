-- ============================================================
-- Live-data follow-up migration.
--
-- Context: the app has no login flow right now, so all server-side data
-- access uses the Supabase service-role key (bypasses RLS) rather than a
-- per-user session. RLS policies from the initial migration stay in place
-- as documentation of intent for when real auth returns, but they are not
-- the active authorization boundary today.
-- ============================================================

-- app_users no longer needs an auth.users account behind it (no signup
-- flow exists) — decouple so Admin can create users freely.
alter table app_users drop constraint app_users_id_fkey;
alter table app_users alter column id set default gen_random_uuid();

-- Gemini extraction can legitimately return no stock/non-stock guess;
-- the capture form allows leaving it blank until reviewed.
alter table invoices alter column stock_type drop not null;

-- SOW §5.7 — per-invoice audit trail (T149) and field-level before/after
-- change capture (T150).
alter table audit_events add column invoice_id uuid references invoices(id);
alter table audit_events add column changes jsonb;
create index audit_events_invoice_idx on audit_events(invoice_id);
