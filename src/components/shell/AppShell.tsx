'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { I, IconComponent } from '@/components/icons';
import { Avatar, IconBtn, Modal, StatusBadge } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { cx, fmtMoney } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useCurrentUser } from '@/components/providers/CurrentUserProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useGo } from '@/lib/navigation';
import { logout } from '@/lib/server/auth-actions';
import { listAppUsers, type CurrentAppUser } from '@/lib/server/users';
import { searchInvoices } from '@/lib/server/invoices';
import { getMyDelegation, setMyDelegation, clearMyDelegation } from '@/lib/server/delegations';
import { errorMessage } from '@/lib/errorMessage';
import type { AppUserRow, InvoiceRow } from '@/lib/supabase/types';
import { useTr } from '@/lib/i18n';
import Image from 'next/image';


interface NavItem { key: string; label: string; icon: IconComponent; count?: number }
interface NavGroup { section: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { section: 'Workspace', items: [
    { key: 'dashboard', label: 'Dashboard', icon: I.dashboard },
    { key: 'capture', label: 'Document Capture', icon: I.capture },
    { key: 'invoices', label: 'Invoice Processing', icon: I.invoice },
    { key: 'workflows', label: 'Workflows', icon: I.zap },
  ] },
  { section: 'Insight', items: [
    { key: 'reports', label: 'Reports', icon: I.reports },
    { key: 'audit', label: 'Audit Trail', icon: I.audit },
    { key: 'notifications', label: 'Notifications', icon: I.bell },
  ] },
  { section: 'Administration', items: [
    { key: 'admin', label: 'User Administration', icon: I.users },
  ] },
];

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard', capture: 'Document Capture', invoices: 'Invoice Processing',
  approvals: 'Approvals', reports: 'Reports & Analytics', audit: 'Audit Trail', admin: 'User Administration',
  workflows: 'Workflows', notifications: 'Notifications',
};

function routeKey(pathname: string): string {
  if (pathname === '/' ) return 'dashboard';
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return seg;
}

function href(key: string) {
  return key === 'dashboard' ? '/dashboard' : `/${key}`;
}

export function AppShell({ children, unreadCount, accessibleModules }: { children: React.ReactNode; unreadCount: number; accessibleModules: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const route = routeKey(pathname);
  const { t, setTweak } = useTheme();
  const tr = useTr();
  const currentUser = useCurrentUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // Reset the scroll position of the content region on navigation.
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const nameParts = currentUser.name.split(' ');
  const firstName = nameParts[0];
  const lastInitial = nameParts[1]?.[0] ?? '';

  // T168 — dashboard is always shown (see requireModuleAccess's dashboard
  // guard note in src/app/(app)/dashboard/page.tsx for why it's exempt).
  const visibleNav = NAV.map(grp => ({ ...grp, items: grp.items.filter(i => i.key === 'dashboard' || accessibleModules.includes(i.key)) }))
    .filter(grp => grp.items.length > 0);

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <Image src="/images/Mindrift_Logo.jpg" alt="MindRift" width={52} height={38} style={{ objectFit: 'contain' }} />
<div style={{ marginLeft: 6 }}>
  <div className="brand-name">PCG | MindRift</div>
  <div className="brand-sub">{tr('Workflow Portal')}</div>
</div>
        </div>
        <nav className="nav">
          {visibleNav.map(grp => (
            <div key={grp.section}>
              <div className="nav-section-label">{tr(grp.section)}</div>
              {grp.items.map(item => {
                const Ico = item.icon;
                return (
                  <Link key={item.key} href={href(item.key)} className={cx('nav-item', route === item.key && 'active')}>
                    <Ico size={18} />
                    {tr(item.label)}
                    {item.count != null && <span className="nav-count">{item.count}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="card" style={{ padding: 13, background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)' }}>
            <div className="row" style={{ gap: 9, marginBottom: 6 }}>
              <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center' }}><I.zap size={14} /></div>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tr('Storage')}</span>
            </div>
            <div className="progress" style={{ margin: '8px 0 6px' }}><span style={{ width: '64%' }} /></div>
            <div className="faint" style={{ fontSize: 11 }}>{tr('64% of 2 TB · 1.28 TB used')}</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <div className="row" style={{ gap: 8 }}>
            <span className="crumb">{tr('Portal')}</span>
            <I.chevR size={14} style={{ color: 'var(--faint)' }} />
            <h1>{tr(TITLES[route] ?? 'Dashboard')}</h1>
          </div>
          <div className="spacer" />
          <TopbarSearch />
          <div className="seg" style={{ marginRight: 2 }} title={tr('Language')}>
            <button className={cx(t.lang !== 'el' && 'on')} onClick={() => setTweak('lang', 'en')}>EN</button>
            <button className={cx(t.lang === 'el' && 'on')} onClick={() => setTweak('lang', 'el')}>ΕΛ</button>
          </div>
          <IconBtn icon={t.dark ? I.sun : I.moon} onClick={() => setTweak('dark', !t.dark)} title={tr('Toggle theme')} />
          <IconBtn icon={I.bell} badge={unreadCount > 0} onClick={() => router.push('/notifications')} title={tr('Notifications')} />
          <div style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
          <button className="row" style={{ gap: 9, border: 'none', background: 'none', padding: '4px 6px', borderRadius: 9 }} onClick={() => setProfileOpen(true)}>
            <Avatar name={currentUser.name} size={34} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>{firstName} {lastInitial}.</div>
              <div className="faint" style={{ fontSize: 10.5 }}>{currentUser.role}</div>
            </div>
            <I.chevD size={14} style={{ color: 'var(--faint)' }} />
          </button>
        </header>

        <main className="content" ref={contentRef}>
          <div className="content-inner">
            {children}
          </div>
        </main>
      </div>

      {profileOpen && (
        <ProfileMenu user={currentUser} onClose={() => setProfileOpen(false)} dark={t.dark} setDark={(v) => setTweak('dark', v)}
          onOpenDelegation={() => setDelegationOpen(true)} />
      )}
      {delegationOpen && <DelegationModal currentUserId={currentUser.id} onClose={() => setDelegationOpen(false)} />}
    </div>
  );
}

function TopbarSearch() {
  const tr = useTr();
  const go = useGo();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<InvoiceRow[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  // ⌘K / Ctrl+K focuses the box from anywhere, matching the hint shown in it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      searchInvoices(q).then(r => { setResults(r); setSearching(false); });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  function pick(code: string) {
    go('invoices', code);
    setQuery('');
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="search" style={{ position: 'relative' }}>
      <I.search size={16} />
      <input ref={inputRef} value={query} placeholder={tr('Search invoices, documents, vendors…')}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results.length > 0) pick(results[0].code); if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); } }} />
      <kbd>⌘K</kbd>

      {showDropdown && (
        <div className="card" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
          {searching ? (
            <div className="faint" style={{ padding: '12px 14px', fontSize: 12.5 }}>{tr('Searching…')}</div>
          ) : results.length === 0 ? (
            <div className="faint" style={{ padding: '12px 14px', fontSize: 12.5 }}>{tr('No matches')}</div>
          ) : (
            results.map((inv, i) => (
              <button key={inv.id} onMouseDown={(e) => { e.preventDefault(); pick(inv.code); }}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: 'none', textAlign: 'left', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent-strong)' }}>{inv.code}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div style={{ fontSize: 12.5, marginTop: 2 }}>{inv.vendor}{inv.po ? ` · ${inv.po}` : ''}</div>
                </div>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>{fmtMoney(inv.total)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user, onClose, dark, setDark, onOpenDelegation }: {
  user: CurrentAppUser; onClose: () => void; dark: boolean; setDark: (v: boolean) => void; onOpenDelegation: () => void;
}) {
  const tr = useTr();
  const items: { icon: IconComponent; label: string }[] = [
    { icon: I.users, label: 'My profile' },
    { icon: I.settings, label: 'Preferences' },
    { icon: I.shield, label: 'Security & MFA' },
  ];
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 56, right: 24, zIndex: 41, width: 252, animation: 'scaleIn 0.15s', transformOrigin: 'top right' }} className="card">
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Avatar name={user.name} size={42} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{user.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{user.email}</div>
          </div>
        </div>
        <div style={{ padding: 6 }}>
          {items.map(m => {
            const Ico = m.icon;
            return <button key={m.label} className="nav-item" onClick={onClose}><Ico size={17} />{tr(m.label)}</button>;
          })}
          <button className="nav-item" onClick={() => { onClose(); onOpenDelegation(); }}>
            <I.history size={17} />{tr('Delegate approvals')}
          </button>
          <button className="nav-item" onClick={() => { setDark(!dark); }}>
            {dark ? <I.sun size={17} /> : <I.moon size={17} />}{dark ? tr('Light mode') : tr('Dark mode')}
          </button>
        </div>
        <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
          <button className="nav-item" onClick={() => { void logout(); }} style={{ color: 'var(--red)' }}>
            <I.logout size={17} />{tr('Sign out')}
          </button>
        </div>
      </div>
    </>
  );
}

function DelegationModal({ currentUserId, onClose }: { currentUserId: string; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const [users, setUsers] = useState<AppUserRow[] | null>(null);
  const [hasExisting, setHasExisting] = useState(false);
  const [backupUserId, setBackupUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listAppUsers(), getMyDelegation()]).then(([u, d]) => {
      setUsers(u);
      if (d) {
        setHasExisting(true);
        setBackupUserId(d.backup_user_id);
        setStartDate(d.start_date);
        setEndDate(d.end_date);
        setNote(d.note ?? '');
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await setMyDelegation(backupUserId, startDate, endDate, note || null);
      toast('Backup approver set');
      onClose();
    } catch (err) {
      toast(`Save failed: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setSaving(true);
    try {
      await clearMyDelegation();
      toast('Delegation removed');
      onClose();
    } catch (err) {
      toast(`Remove failed: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Delegate approvals" sub="Route your pending tasks to a backup approver while you're out" onClose={onClose}
      footer={<>
        {hasExisting && <button className="btn" onClick={clear} disabled={saving}>Remove delegation</button>}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save} disabled={!backupUserId || !startDate || !endDate || saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      {!users ? (
        <div className="empty"><I.refresh size={24} style={{ animation: 'spin 0.9s linear infinite' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field"><label>{tr('Backup approver')}</label>
            <select className="input" value={backupUserId} onChange={e => setBackupUserId(e.target.value)}>
              <option value="">{tr('Select a user')}</option>
              {users.filter(u => u.id !== currentUserId && u.status === 'Active').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field"><label>{tr('Start date')}</label><input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="field"><label>{tr('End date')}</label><input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate || undefined} /></div>
          </div>
          <div className="field"><label>{tr('Note (optional)')}</label><input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder={tr('e.g. Annual leave')} /></div>
        </div>
      )}
    </Modal>
  );
}
