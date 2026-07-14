-- Adds a second Capture entry point — "Special Invoice" — alongside the
-- existing standard flow. Special Invoice has its own Document Number
-- field and replaces Line Items with a Material Code table (Item/Material/
-- Description/Total/UOM) instead of Description/Qty/Unit Price/GL Code.
-- Both kinds still go through the same Stock/Non-Stock approval workflow.
alter table invoices add column invoice_kind text not null default 'Standard' check (invoice_kind in ('Standard', 'Special'));
alter table invoices add column document_number text;

-- Reused for Special Invoice's Material Code table rows instead of adding a
-- parallel table — `description`/`amount` already fit "Description"/"Total".
alter table invoice_line_items add column item text;
alter table invoice_line_items add column material text;
alter table invoice_line_items add column uom text;
