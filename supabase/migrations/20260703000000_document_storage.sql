-- Persists the original uploaded document (PDF/image) so it can be viewed
-- later from the Invoice Processing screen — previously only the extracted
-- data was saved, not the file itself.

insert into storage.buckets (id, name, public)
values ('invoice-documents', 'invoice-documents', false)
on conflict (id) do nothing;

alter table invoices add column document_path text;
alter table invoices add column document_mime_type text;

-- Service-role access only (same as every other table in this app right
-- now — see src/lib/supabase/service.ts) but add baseline storage policies
-- for when real auth returns.
create policy "Authenticated read invoice-documents" on storage.objects
  for select using (bucket_id = 'invoice-documents' and auth.role() = 'authenticated');
create policy "Authenticated write invoice-documents" on storage.objects
  for insert with check (bucket_id = 'invoice-documents' and auth.role() = 'authenticated');
