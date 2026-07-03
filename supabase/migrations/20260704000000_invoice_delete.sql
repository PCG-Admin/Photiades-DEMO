-- Lets an invoice be deleted cleanly (e.g. a duplicate capture): its own
-- workflow instance/history goes with it, but "soft" references from other
-- tables (documents, notifications, audit log) are preserved and just lose
-- the link — deleting an invoice should never silently erase its audit
-- trail or notification history.

alter table workflow_instances drop constraint workflow_instances_invoice_id_fkey;
alter table workflow_instances add constraint workflow_instances_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete cascade;

alter table documents drop constraint documents_invoice_id_fkey;
alter table documents add constraint documents_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

alter table notifications drop constraint notifications_ref_invoice_id_fkey;
alter table notifications add constraint notifications_ref_invoice_id_fkey
  foreign key (ref_invoice_id) references invoices(id) on delete set null;

alter table audit_events drop constraint audit_events_invoice_id_fkey;
alter table audit_events add constraint audit_events_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

create index invoices_vendor_invoice_no_idx on invoices(lower(vendor), lower(invoice_no));
