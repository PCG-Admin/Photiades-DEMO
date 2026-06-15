'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { I, IconComponent } from '@/components/icons';
import { Avatar, IconBtn } from '@/components/ui';
import { CURRENT_USER } from '@/lib/data';
import { cx } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import { logout } from '@/lib/auth-actions';

interface NavItem { key: string; label: string; icon: IconComponent; count?: number }
interface NavGroup { section: string; items: NavItem[] }

const NAV: NavGroup[] = [
  { section: 'Workspace', items: [
    { key: 'dashboard', label: 'Dashboard', icon: I.dashboard },
    { key: 'capture', label: 'Document Capture', icon: I.capture, count: 22 },
    { key: 'invoices', label: 'Invoice Processing', icon: I.invoice, count: 28 },
    { key: 'workflows', label: 'Workflows', icon: I.zap, count: 6 },
  ] },
  { section: 'Insight', items: [
    { key: 'reports', label: 'Reports', icon: I.reports },
    { key: 'audit', label: 'Audit Trail', icon: I.audit },
  ] },
  { section: 'Administration', items: [
    { key: 'admin', label: 'User Administration', icon: I.users },
  ] },
];

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard', capture: 'Document Capture', invoices: 'Invoice Processing',
  approvals: 'Approvals', reports: 'Reports & Analytics', audit: 'Audit Trail', admin: 'User Administration',
  workflows: 'Workflows',
};

function routeKey(pathname: string): string {
  if (pathname === '/' ) return 'dashboard';
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return seg;
}

function href(key: string) {
  return key === 'dashboard' ? '/dashboard' : `/${key}`;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const route = routeKey(pathname);
  const { t, setTweak } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // Reset the scroll position of the content region on navigation.
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const firstName = CURRENT_USER.name.split(' ')[0];
  const lastInitial = CURRENT_USER.name.split(' ')[1][0];

  return (
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div>
            <div className="brand-name">Photiades</div>
            <div className="brand-sub">Workflow Portal</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(grp => (
            <div key={grp.section}>
              <div className="nav-section-label">{grp.section}</div>
              {grp.items.map(item => {
                const Ico = item.icon;
                return (
                  <Link key={item.key} href={href(item.key)} className={cx('nav-item', route === item.key && 'active')}>
                    <Ico size={18} />
                    {item.label}
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
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Storage</span>
            </div>
            <div className="progress" style={{ margin: '8px 0 6px' }}><span style={{ width: '64%' }} /></div>
            <div className="faint" style={{ fontSize: 11 }}>64% of 2 TB · 1.28 TB used</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="topbar">
          <div className="row" style={{ gap: 8 }}>
            <span className="crumb">Portal</span>
            <I.chevR size={14} style={{ color: 'var(--faint)' }} />
            <h1>{TITLES[route] ?? 'Dashboard'}</h1>
          </div>
          <div className="spacer" />
          <div className="search">
            <I.search size={16} />
            <input placeholder="Search invoices, documents, vendors…" />
            <kbd>⌘K</kbd>
          </div>
          <IconBtn icon={t.dark ? I.sun : I.moon} onClick={() => setTweak('dark', !t.dark)} title="Toggle theme" />
          <IconBtn icon={I.bell} badge title="Notifications" />
          <div style={{ width: 1, height: 26, background: 'var(--border)', margin: '0 4px' }} />
          <button className="row" style={{ gap: 9, border: 'none', background: 'none', padding: '4px 6px', borderRadius: 9 }} onClick={() => setProfileOpen(true)}>
            <Avatar name={CURRENT_USER.name} size={34} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>{firstName} {lastInitial}.</div>
              <div className="faint" style={{ fontSize: 10.5 }}>{CURRENT_USER.role}</div>
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

      {profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} dark={t.dark} setDark={(v) => setTweak('dark', v)} />}
    </div>
  );
}

function ProfileMenu({ onClose, dark, setDark }: { onClose: () => void; dark: boolean; setDark: (v: boolean) => void }) {
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
          <Avatar name={CURRENT_USER.name} size={42} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{CURRENT_USER.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>elena.constantinou@photiades.com.cy</div>
          </div>
        </div>
        <div style={{ padding: 6 }}>
          {items.map(m => {
            const Ico = m.icon;
            return <button key={m.label} className="nav-item" onClick={onClose}><Ico size={17} />{m.label}</button>;
          })}
          <button className="nav-item" onClick={() => { setDark(!dark); }}>
            {dark ? <I.sun size={17} /> : <I.moon size={17} />}{dark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
        <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
          <form action={logout}>
            <button type="submit" className="nav-item" style={{ color: 'var(--red)', width: '100%' }}><I.logout size={17} />Sign out</button>
          </form>
        </div>
      </div>
    </>
  );
}
