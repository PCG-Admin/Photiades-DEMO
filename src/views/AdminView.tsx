'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { StatusBadge, Avatar, Badge, Segmented, Modal, PageHeader, MiniStat, Pagination, usePagination } from '@/components/ui';
import { cx } from '@/lib/utils';
import { RelativeTime } from '@/components/RelativeTime';
import { ROLES, DEPTS } from '@/lib/constants';
import { createAppUser, updateAppUser, type NewAppUser } from '@/lib/server/users';
import { createApproverMapping, deleteApproverMapping, type NewApproverMapping } from '@/lib/server/approverMappings';
import { setRolePermission } from '@/lib/server/permissions';
import { ASSIGNABLE_TASKS } from '@/lib/workflow';
import { fmtMoney } from '@/lib/utils';
import { useToast } from '@/components/providers/ToastProvider';
import { useTr } from '@/lib/i18n';
import type { AppUserRow, ApproverMappingRow, RolePermissionRow, PortalModule } from '@/lib/supabase/types';
import { errorMessage } from '@/lib/errorMessage';

type EditUser = Partial<AppUserRow> & { isNew?: boolean; password?: string };

const EDITABLE_ROLES = ROLES.filter(r => r !== 'Administrator') as AppUserRow['role'][];
const PERMISSION_MODULES: { key: PortalModule; label: string; locked?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', locked: true },
  { key: 'capture', label: 'Document Capture' },
  { key: 'invoices', label: 'Invoice Processing' },
  { key: 'workflows', label: 'Workflows' },
  { key: 'reports', label: 'Reports' },
  { key: 'audit', label: 'Audit Trail' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'admin', label: 'User Administration' },
];

// =================== USER ADMINISTRATION ===================
export function AdminView({ initialUsers, initialMappings, initialPermissions }: {
  initialUsers: AppUserRow[]; initialMappings: ApproverMappingRow[]; initialPermissions: RolePermissionRow[];
}) {
  const tr = useTr();
  const toast = useToast();
  const [users, setUsers] = useState<AppUserRow[]>(initialUsers);
  const [mappings, setMappings] = useState<ApproverMappingRow[]>(initialMappings);
  const [permissions, setPermissions] = useState<RolePermissionRow[]>(initialPermissions);
  const [tab, setTab] = useState('Users');
  const [edit, setEdit] = useState<EditUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingMapping, setAddingMapping] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);

  const roleTone: Record<string, string> = { Administrator: 'violet', 'AP Manager': 'blue', 'AP Clerk': 'teal', Approver: 'green', Auditor: 'amber', Viewer: 'gray' };

  const rolePerms = [
    { role: 'Administrator', perms: 'Full access · user & system config', tone: 'violet' },
    { role: 'AP Manager', perms: 'Approve, process, assign, report', tone: 'blue' },
    { role: 'AP Clerk', perms: 'Capture, process, submit', tone: 'teal' },
    { role: 'Approver', perms: 'Approve within threshold', tone: 'green' },
    { role: 'Auditor', perms: 'Read-only · audit & reports', tone: 'amber' },
    { role: 'Viewer', perms: 'Read-only · dashboards', tone: 'gray' },
  ];

  const usersPagination = usePagination(users);
  const mappingsPagination = usePagination(mappings);

  function hasAccess(role: AppUserRow['role'], module: PortalModule): boolean {
    return permissions.find(p => p.role === role && p.module === module)?.can_access ?? false;
  }

  async function togglePermission(role: AppUserRow['role'], module: PortalModule, next: boolean) {
    setPermissions(prev => {
      const exists = prev.some(p => p.role === role && p.module === module);
      return exists ? prev.map(p => (p.role === role && p.module === module ? { ...p, can_access: next } : p)) : [...prev, { role, module, can_access: next }];
    });
    try {
      await setRolePermission(role, module, next);
    } catch (err) {
      toast(`Save failed: ${errorMessage(err)}`);
      setPermissions(prev => prev.map(p => (p.role === role && p.module === module ? { ...p, can_access: !next } : p)));
    }
  }

  async function save(u: EditUser) {
    setSaving(true);
    try {
      if (u.isNew) {
        const created = await createAppUser(
          { name: u.name ?? '', email: u.email ?? '', role: (u.role ?? 'AP Clerk') as AppUserRow['role'], dept: u.dept ?? 'Finance' },
          u.password ?? ''
        );
        setUsers(prev => [created, ...prev]);
        toast('User created — share their temporary password so they can sign in');
      } else if (u.id) {
        const patch: Partial<NewAppUser & { status: AppUserRow['status'] }> = { name: u.name, email: u.email, role: u.role as AppUserRow['role'], dept: u.dept, status: u.status };
        const updated = await updateAppUser(u.id, patch);
        setUsers(prev => prev.map(x => x.id === updated.id ? updated : x));
        toast('User updated');
      }
      setEdit(null);
    } catch (err) {
      toast(`Save failed: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveMapping(m: NewApproverMapping) {
    setSavingMapping(true);
    try {
      const created = await createApproverMapping(m);
      setMappings(prev => [...prev, created]);
      toast('Approver mapping added');
      setAddingMapping(false);
    } catch (err) {
      toast(`Save failed: ${errorMessage(err)}`);
    } finally {
      setSavingMapping(false);
    }
  }

  async function removeMapping(id: string) {
    try {
      await deleteApproverMapping(id);
      setMappings(prev => prev.filter(m => m.id !== id));
      toast('Approver mapping removed');
    } catch (err) {
      toast(`Delete failed: ${errorMessage(err)}`);
    }
  }

  return (
    <div className="view-enter">
      <PageHeader title={tr('User Administration')} sub={tr('Manage users, roles, and access across the Photiades portal.')}
        actions={
          tab === 'Users'
            ? <button className="btn primary" onClick={() => setEdit({ name: '', email: '', role: 'AP Clerk', dept: 'Finance', status: 'Active', isNew: true })}><I.plus size={16} />{tr('Add user')}</button>
            : tab === 'Approver Mapping'
            ? <button className="btn primary" onClick={() => setAddingMapping(true)}><I.plus size={16} />{tr('Add mapping')}</button>
            : undefined
        } />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label={tr('Total users')} value={users.length} sub={`${users.filter(u => u.status === 'Active').length} ${tr('active')}`} tone="blue" />
        <MiniStat label={tr('Roles configured')} value={ROLES.length} tone="violet" />
        <MiniStat label={tr('MFA enabled')} value={users.length === 0 ? '—' : `${Math.round(users.filter(u => u.mfa_enabled).length / users.length * 100)}%`} sub={tr('of all users')} tone="green" />
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--gap-5)' }}>
        {['Users', 'Roles & Permissions', 'Approver Mapping'].map(t => (
          <button key={t} className={cx('tab', tab === t && 'on')} onClick={() => setTab(t)}>{tr(t)}</button>
        ))}
      </div>

      {tab === 'Users' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>{tr('User')}</th><th>{tr('Role')}</th><th>{tr('Department')}</th><th>{tr('Status')}</th><th>{tr('MFA')}</th><th>{tr('Last active')}</th></tr>
            </thead>
            <tbody>
              {usersPagination.pageItems.map(u => (
                <tr key={u.id} className="clickable" onClick={() => setEdit(u)}>
                  <td>
                    <div className="row" style={{ gap: 11 }}>
                      <Avatar name={u.name} size={34} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                        <div className="faint" style={{ fontSize: 11.5 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={roleTone[u.role]}>{tr(u.role)}</Badge></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{u.dept}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>{u.mfa_enabled ? <span className="badge green"><I.shield size={12} />{tr('On')}</span> : <span className="faint" style={{ fontSize: 12 }}>{tr('Off')}</span>}</td>
                  <td className="faint" style={{ fontSize: 12 }}>{u.last_active_at ? <RelativeTime date={new Date(u.last_active_at)} /> : tr('Never')}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="faint" style={{ padding: 20, textAlign: 'center' }}>{tr('No users yet')}</td></tr>}
            </tbody>
          </table>
          <Pagination page={usersPagination.page} totalPages={usersPagination.totalPages} onChange={usersPagination.setPage} total={usersPagination.total} pageSize={usersPagination.pageSize} />
        </div>
      ) : tab === 'Roles & Permissions' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-5)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)' }}>
            {rolePerms.map(r => (
              <div key={r.role} className="card card-pad">
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                  <Badge tone={r.tone}>{tr(r.role)}</Badge>
                  <span className="muted" style={{ fontSize: 12 }}><span className="mono">{users.filter(u => u.role === r.role).length}</span> {tr('users')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{tr(r.perms)}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-head">
              <div className="card-title">{tr('Per-module access')}</div>
              <span className="faint" style={{ fontSize: 12 }}>{tr('Administrator always has full access')}</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{tr('Module')}</th>
                  {EDITABLE_ROLES.map(r => <th key={r} className="right">{tr(r)}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MODULES.map(mod => (
                  <tr key={mod.key}>
                    <td style={{ fontSize: 13 }}>{tr(mod.label)}{mod.locked && <span className="faint" style={{ fontSize: 11, marginLeft: 6 }}>({tr('always on')})</span>}</td>
                    {EDITABLE_ROLES.map(role => (
                      <td key={role} className="right">
                        <input type="checkbox" disabled={mod.locked}
                          checked={mod.locked ? true : hasAccess(role, mod.key)}
                          onChange={e => togglePermission(role, mod.key, e.target.checked)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>{tr('Task')}</th><th>{tr('Amount range')}</th><th>{tr('Routes to')}</th><th /></tr>
            </thead>
            <tbody>
              {mappingsPagination.pageItems.map(m => {
                const task = ASSIGNABLE_TASKS.find(t => t.id === m.task_id);
                const approverUser = users.find(u => u.id === m.approver_user_id);
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 13 }}>{task ? `${tr(task.workflowShort)} — ${tr(task.name)}` : m.task_id}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>
                      {m.min_amount == null && m.max_amount == null ? tr('Any amount')
                        : m.max_amount == null ? `${tr('Above')} ${fmtMoney(m.min_amount!)}`
                        : m.min_amount == null ? `${tr('Up to')} ${fmtMoney(m.max_amount)}`
                        : `${fmtMoney(m.min_amount)} – ${fmtMoney(m.max_amount)}`}
                    </td>
                    <td>
                      <Badge tone={roleTone[m.approver_role]}>{tr(m.approver_role)}</Badge>
                      {approverUser && <span className="muted" style={{ fontSize: 12.5, marginLeft: 8 }}>{approverUser.name}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button title={tr('Remove')} onClick={() => removeMapping(m.id)} style={{ border: 'none', background: 'none', color: 'var(--faint)', display: 'grid', placeItems: 'center', padding: 6, borderRadius: 6, cursor: 'pointer' }}><I.trash size={14} /></button>
                    </td>
                  </tr>
                );
              })}
              {mappings.length === 0 && <tr><td colSpan={4} className="faint" style={{ padding: 20, textAlign: 'center' }}>{tr('No approver mappings configured — tasks fall back to their default role.')}</td></tr>}
            </tbody>
          </table>
          <Pagination page={mappingsPagination.page} totalPages={mappingsPagination.totalPages} onChange={mappingsPagination.setPage} total={mappingsPagination.total} pageSize={mappingsPagination.pageSize} />
        </div>
      )}

      {edit && <UserModal user={edit} saving={saving} onClose={() => setEdit(null)} onSave={save} />}
      {addingMapping && <ApproverMappingModal users={users} saving={savingMapping} onClose={() => setAddingMapping(false)} onSave={saveMapping} />}
    </div>
  );
}

function UserModal({ user, saving, onClose, onSave }: { user: EditUser; saving: boolean; onClose: () => void; onSave: (u: EditUser) => void }) {
  const tr = useTr();
  const [form, setForm] = useState<EditUser>(user);
  const set = (k: keyof EditUser, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={user.isNew ? tr('Add user') : tr('Edit user')} sub={user.isNew ? tr('Create a new directory entry') : user.email} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{tr('Cancel')}</button>
        <button className="btn primary" onClick={() => onSave(form)} disabled={!form.name || (user.isNew && !form.password) || saving}>{saving ? tr('Saving…') : user.isNew ? tr('Create') : tr('Save changes')}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label>{tr('Full name')}</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Andreas Pavlou" /></div>
        <div className="field"><label>{tr('Email')}</label><input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@photiades.com.cy" /></div>
        {user.isNew && (
          <div className="field">
            <label>{tr('Temporary password')}</label>
            <input className="input" type="text" value={form.password ?? ''} onChange={e => set('password', e.target.value)} placeholder={tr('Shared with the user to sign in')} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>{tr('Role')}</label>
            <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{tr(r)}</option>)}
            </select>
          </div>
          <div className="field"><label>{tr('Department')}</label>
            <select className="input" value={form.dept} onChange={e => set('dept', e.target.value)}>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>{tr('Status')}</label>
          <Segmented options={[{ value: 'Active', label: tr('Active') }, { value: 'Inactive', label: tr('Inactive') }]} value={form.status ?? ''} onChange={(v) => set('status', String(v))} />
        </div>
      </div>
    </Modal>
  );
}

function ApproverMappingModal({ users, saving, onClose, onSave }: {
  users: AppUserRow[]; saving: boolean; onClose: () => void; onSave: (m: NewApproverMapping) => void;
}) {
  const tr = useTr();
  const [taskId, setTaskId] = useState(ASSIGNABLE_TASKS[0]?.id ?? '');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [role, setRole] = useState<AppUserRow['role']>('Approver');
  const [approverUserId, setApproverUserId] = useState('');

  const eligibleUsers = users.filter(u => u.role === role && u.status === 'Active');

  return (
    <Modal title={tr('Add approver mapping')} sub={tr('Route a task to a role or specific approver when the invoice amount matches')}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{tr('Cancel')}</button>
        <button className="btn primary" disabled={!taskId || saving} onClick={() => onSave({
          task_id: taskId,
          min_amount: minAmount ? Number(minAmount) : null,
          max_amount: maxAmount ? Number(maxAmount) : null,
          approver_role: role,
          approver_user_id: approverUserId || null,
        })}>{saving ? tr('Saving…') : tr('Add mapping')}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label>{tr('Task')}</label>
          <select className="input" value={taskId} onChange={e => setTaskId(e.target.value)}>
            {ASSIGNABLE_TASKS.map(t => <option key={t.id} value={t.id}>{tr(t.workflowShort)} — {tr(t.name)}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>{tr('Min amount (optional)')}</label>
            <input className="input" type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder={tr('No lower bound')} />
          </div>
          <div className="field"><label>{tr('Max amount (optional)')}</label>
            <input className="input" type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder={tr('No upper bound')} />
          </div>
        </div>
        <div className="field"><label>{tr('Route to role')}</label>
          <select className="input" value={role} onChange={e => { setRole(e.target.value as AppUserRow['role']); setApproverUserId(''); }}>
            {ROLES.map(r => <option key={r} value={r}>{tr(r)}</option>)}
          </select>
        </div>
        <div className="field"><label>{tr('Specific approver (optional)')}</label>
          <select className="input" value={approverUserId} onChange={e => setApproverUserId(e.target.value)}>
            <option value="">{tr('Anyone with this role')}</option>
            {eligibleUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
