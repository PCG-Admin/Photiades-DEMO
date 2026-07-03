import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · Photiades Workflow Portal',
};

export default function LoginPage() {
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
        </div>

        <div className="faint" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 18 }}>© 2026 Photiades Group · Workflow Portal</div>
      </div>
    </div>
  );
}
