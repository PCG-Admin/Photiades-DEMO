-- Special Invoice gets its own 4-step approval chain (Accounts Department →
-- Requisitioner → Accounts Manager → Accounts Department), distinct from
-- the Stock/Non-Stock chains — task definitions live in src/lib/workflow.ts
-- (WF_SPECIAL_TASKS), same as the existing two.
alter table workflow_instances drop constraint if exists workflow_instances_wf_id_check;
alter table workflow_instances add constraint workflow_instances_wf_id_check
  check (wf_id in ('stock', 'nonstock', 'special'));
