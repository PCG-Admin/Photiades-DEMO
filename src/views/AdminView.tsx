'use client';

import { useState } from 'react';
import { I } from '@/components/icons';
import { StatusBadge, Avatar, Badge, Segmented, Modal, PageHeader, MiniStat } from '@/components/ui';
import { cx } from '@/lib/utils';
import { USERS, ROLES, DEPTS, relTime, range, daysAgo, type User } from '@/lib/data';
import { useToast } from '@/components/providers/ToastProvider';

type EditUser = Partial<User> & { isNew?: boolean };

// =================== USER ADMINISTRATION ===================
export function AdminView() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>(USERS);
  const [tab, setTab] = useState('Users');
  const [edit, setEdit] = useState<EditUser | null>(null);

  const roleTone: Record<string, string> = { Administrator: 'violet', 'AP Manager': 'blue', 'AP Clerk': 'teal', Approver: 'green', Auditor: 'amber', Viewer: 'gray' };

  const rolePerms = [
    { role: 'Administrator', users: 1, perms: 'Full access · user & system config', tone: 'violet' },
    { role: 'AP Manager', users: 1, perms: 'Approve, process, assign, report', tone: 'blue' },
    { role: 'AP Clerk', users: 3, perms: 'Capture, process, submit', tone: 'teal' },
    { role: 'Approver', users: 3, perms: 'Approve within threshold', tone: 'green' },
    { role: 'Auditor', users: 1, perms: 'Read-only · audit & reports', tone: 'amber' },
    { role: 'Viewer', users: 1, perms: 'Read-only · dashboards', tone: 'gray' },
  ];

  return (
    <div className="view-enter">
      <PageHeader title="User Administration" sub="Manage users, roles, and access across the Photiades portal."
        actions={<button className="btn primary" onClick={() => setEdit({ name: '', email: '', role: 'AP Clerk', dept: 'Finance', status: 'Active', isNew: true })}><I.plus size={16} />Add user</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Total users" value={users.length} sub={`${users.filter(u => u.status === 'Active').length} active`} tone="blue" />
        <MiniStat label="Roles configured" value="6" tone="violet" />
        <MiniStat label="MFA enabled" value={`${Math.round(users.filter(u => u.mfa).length / users.length * 100)}%`} sub="of all users" tone="green" />
        <MiniStat label="Pending invites" value="2" tone="amber" />
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
              <tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th>MFA</th><th>Last active</th><th style={{ width: 40 }}></th></tr>
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
                  <td>{u.mfa ? <span className="badge green"><I.shield size={12} />On</span> : <span className="faint" style={{ fontSize: 12 }}>Off</span>}</td>
                  <td className="faint" style={{ fontSize: 12 }}>{relTime(u.lastActive)}</td>
                  <td onClick={e => e.stopPropagation()}><button className="icon-btn" style={{ width: 28, height: 28 }}><I.dots size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)' }}>
          {rolePerms.map(r => (
            <div key={r.role} className="card card-pad">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <Badge tone={r.tone}>{r.role}</Badge>
                <span className="muted" style={{ fontSize: 12 }}><span className="mono">{r.users}</span> {r.users === 1 ? 'user' : 'users'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{r.perms}</div>
              <div className="row" style={{ gap: 8, marginTop: 16 }}>
                <button className="btn sm"><I.edit size={13} />Edit role</button>
                <button className="btn ghost sm">View permissions</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && <UserModal user={edit} roleTone={roleTone} onClose={() => setEdit(null)} onSave={(u) => {
        if (u.isNew) { setUsers(prev => [{ ...u, id: `USR-${range(2030, 2099)}`, lastActive: daysAgo(0), mfa: false } as User, ...prev]); toast('User invited'); }
        else { setUsers(prev => prev.map(x => x.id === u.id ? u as User : x)); toast('User updated'); }
        setEdit(null);
      }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSave }: { user: EditUser; roleTone: Record<string, string>; onClose: () => void; onSave: (u: EditUser) => void }) {
  const [form, setForm] = useState<EditUser>(user);
  const set = (k: keyof EditUser, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={user.isNew ? 'Add user' : 'Edit user'} sub={user.isNew ? 'Invite a new member to the portal' : user.email} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => onSave(form)} disabled={!form.name}>{user.isNew ? 'Send invite' : 'Save changes'}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field"><label>Full name</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Andreas Pavlou" /></div>
        <div className="field"><label>Email</label><input className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@photiades.com.cy" /></div>
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
