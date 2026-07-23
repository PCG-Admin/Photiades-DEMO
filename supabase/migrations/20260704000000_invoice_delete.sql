-- Lets an invoice be deleted cleanly (e.g. a duplicate capture): its own
-- workflow instance/history goes with it, but "soft" references from other
-- tables (invoice_documents, invoice_notifications, audit log) are preserved and just lose
-- the link — deleting an invoice should never silently erase its audit
-- trail or notification history.

alter table invoice_workflow_instances drop constraint invoice_workflow_instances_invoice_id_fkey;
alter table invoice_workflow_instances add constraint invoice_workflow_instances_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete cascade;

alter table invoice_documents drop constraint invoice_documents_invoice_id_fkey;
alter table invoice_documents add constraint invoice_documents_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

alter table invoice_notifications drop constraint invoice_notifications_ref_invoice_id_fkey;
alter table invoice_notifications add constraint invoice_notifications_ref_invoice_id_fkey
  foreign key (ref_invoice_id) references invoices(id) on delete set null;

alter table invoice_audit_events drop constraint invoice_audit_events_invoice_id_fkey;
alter table invoice_audit_events add constraint invoice_audit_events_invoice_id_fkey
  foreign key (invoice_id) references invoices(id) on delete set null;

create index invoices_vendor_invoice_no_idx on invoices(lower(vendor), lower(invoice_no));
