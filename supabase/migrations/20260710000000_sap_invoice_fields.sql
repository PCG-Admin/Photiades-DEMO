-- SAP Posting Type and SAP Invoice Text exist as fields on the Capture form
-- but were never actually persisted anywhere — needed now so they can be
-- included in the DocuWare/SAP XML export payload.
alter table invoices add column sap_posting_type text;
alter table invoices add column sap_inv_text text;
