import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';
import { AUTH_USERS } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign in · Photiades Workflow Portal',
};

export default function LoginPage() {
  const demo = AUTH_USERS[0];
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="row" style={{ gap: 12, justifyContent: 'center', marginBottom: 24 }}>
          <div className="brand-mark" style={{ width: 40, height: 40, fontSize: 18 }}>P</div>
          <div>
            <div className="brand-name" style={{ fontSize: 18 }}>Photiades</div>
            <div className="brand-sub">Workflow Portal</div>
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Welcome back</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>Sign in to continue to the portal.</p>
          </div>

          <LoginForm />

          <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-softer)', border: '1px solid var(--accent-soft)', fontSize: 12, color: 'var(--text-2)' }}>
            <div style={{ fontWeight: 600, marginBottom: 5 }}>Demo credentials</div>
            <div className="mono" style={{ fontSize: 11.5 }}>{demo.email}</div>
            <div className="mono" style={{ fontSize: 11.5 }}>{demo.password}</div>
          </div>
        </div>

        <div className="faint" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 18 }}>© 2026 Photiades Group · Workflow Portal</div>
      </div>
    </div>
  );
}
