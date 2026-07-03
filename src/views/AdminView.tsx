'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { StatusBadge, Avatar, Badge, Segmented, Modal, PageHeader, MiniStat } from '@/components/ui';
import { cx } from '@/lib/utils';
import { RelativeTime } from '@/components/RelativeTime';
import { ROLES, DEPTS } from '@/lib/constants';
import { createAppUser, updateAppUser, type NewAppUser } from '@/lib/server/users';
import { useToast } from '@/components/providers/ToastProvider';
import type { AppUserRow } from '@/lib/supabase/types';
import { errorMessage } from '@/lib/errorMessage';

type EditUser = Partial<AppUserRow> & { isNew?: boolean; password?: string };

// =================== USER ADMINISTRATION ===================
export function AdminView({ initialUsers }: { initialUsers: AppUserRow[] }) {
  const toast = useToast();
  const [users, setUsers] = useState<AppUserRow[]>(initialUsers);
  const [tab, setTab] = useState('Users');
  const [edit, setEdit] = useState<EditUser | null>(null);
  const [saving, setSaving] = useState(false);

  const roleTone: Record<string, string> = { Administrator: 'violet', 'AP Manager': 'blue', 'AP Clerk': 'teal', Approver: 'green', Auditor: 'amber', Viewer: 'gray' };

  const rolePerms = [
    { role: 'Administrator', perms: 'Full access · user & system config', tone: 'violet' },
    { role: 'AP Manager', perms: 'Approve, process, assign, report', tone: 'blue' },
    { role: 'AP Clerk', perms: 'Capture, process, submit', tone: 'teal' },
    { role: 'Approver', perms: 'Approve within threshold', tone: 'green' },
    { role: 'Auditor', perms: 'Read-only · audit & reports', tone: 'amber' },
    { role: 'Viewer', perms: 'Read-only · dashboards', tone: 'gray' },
  ];

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

  return (
    <div className="view-enter">
      <PageHeader title="User Administration" sub="Manage users, roles, and access across the Photiades portal."
        actions={<button className="btn primary" onClick={() => setEdit({ name: '', email: '', role: 'AP Clerk', dept: 'Finance', status: 'Active', isNew: true })}><I.plus size={16} />Add user</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Total users" value={users.length} sub={`${users.filter(u => u.status === 'Active').length} active`} tone="blue" />
        <MiniStat label="Roles configured" value={ROLES.length} tone="violet" />
        <MiniStat label="MFA enabled" value={users.length === 0 ? '—' : `${Math.round(users.filter(u => u.mfa_enabled).length / users.length * 100)}%`} sub="of all users" tone="green" />
      </div>

      <div className="tabs" style={{ marginBottom: 'var(--gap-5)' }}>
        {['Users', 'Roles & Permissions'].map(t => (
          <button key={t} className={cx('tab', tab === t && 'on')} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Users' ? (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>MFA</th><th>Last active</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
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
                  <td><Badge tone={roleTone[u.role]}>{u.role}</Badge></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{u.dept}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td>{u.mfa_enabled ? <span className="badge green"><I.shield size={12} />On</span> : <span className="faint" style={{ fontSize: 12 }}>Off</span>}</td>
                  <td className="faint" style={{ fontSize: 12 }}>{u.last_active_at ? <RelativeTime date={new Date(u.last_active_at)} /> : 'Never'}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="faint" style={{ padding: 20, textAlign: 'center' }}>No users yet</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)' }}>
          {rolePerms.map(r => (
            <div key={r.role} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <Badge tone={r.tone}>{r.role}</Badge>
                <span className="muted" style={{ fontSize: 12 }}><span className="mono">{users.filter(u => u.role === r.role).length}</span> users</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{r.perms}</div>
            </div>
          ))}
        </div>
      )}

      {edit && <UserModal user={edit} saving={saving} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function UserModal({ user, saving, onClose, onSave }: { user: EditUser; saving: boolean; onClose: () => void; onSave: (u: EditUser) => void }) {
  const [form, setForm] = useState<EditUser>(user);
  const set = (k: keyof EditUser, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={user.isNew ? 'Add user' : 'Edit user'} sub={user.isNew ? 'Create a new directory entry' : user.email} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(form)} disabled={!form.name || (user.isNew && !form.password) || saving}>{saving ? 'Saving…' : user.isNew ? 'Create' : 'Save changes'}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label>Full name</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Andreas Pavlou" /></div>
        <div className="field"><label>Email</label><input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@photiades.com.cy" /></div>
        {user.isNew && (
          <div className="field">
            <label>Temporary password</label>
            <input className="input" type="text" value={form.password ?? ''} onChange={e => set('password', e.target.value)} placeholder="Shared with the user to sign in" />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Role</label>
            <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="field"><label>Department</label>
            <select className="input" value={form.dept} onChange={e => set('dept', e.target.value)}>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="field"><label>Status</label>
          <Segmented options={['Active', 'Inactive']} value={form.status ?? ''} onChange={(v) => set('status', String(v))} />
        </div>
      </div>
    </Modal>
  );
}
