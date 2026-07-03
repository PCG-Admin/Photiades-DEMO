-- Exact-file duplicate detection. The vendor+invoice_no check
-- (findDuplicateInvoice) is a good heuristic but relies on Gemini
-- extracting identical text twice, which isn't guaranteed — this catches
-- the literal "uploaded the same file again" case deterministically via a
-- client-computed SHA-256 hash of the file bytes.

alter table invoices add column document_hash text;
create index invoices_document_hash_idx on invoices(document_hash);
