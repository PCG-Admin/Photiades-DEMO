-- ---------- workflow_instances.return_task_idx (Request Info resume point) ----------
-- "Request Info" always routes back to AP Clerk (task_idx 0) so they can fix
-- or add missing details — but previously, resubmitting from there always
-- resumed at task_idx 1, re-running every approval step that had already
-- happened before the question was raised. This records where to resume
-- once the clerk resubmits, instead of restarting the whole chain.
alter table workflow_instances add column return_task_idx int;
