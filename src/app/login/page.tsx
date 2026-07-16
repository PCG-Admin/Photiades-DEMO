import type { Metadata } from 'next';
import Image from 'next/image';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · Photiades Workflow Portal',
};

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="row" style={{ gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Image src="/images/photos-photiades-group-logo.jpg" alt="Photiades Group" width={40} height={40} style={{ borderRadius: 9, objectFit: 'cover' }} />
            <div>
              <div className="brand-name" style={{ fontSize: 18 }}>Photiades</div>
              <div className="brand-sub">Workflow Portal</div>
            </div>
            <div style={{ width: 1, height: 30, background: 'var(--border-strong)', margin: '0 4px' }} />
            <Image src="/images/Mindrift_Logo.jpg" alt="MindRift" width={88} height={64} style={{ objectFit: 'contain' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Welcome back</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>Sign in to continue to the portal.</p>
          </div>

          <LoginForm />

          <div className="faint" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 22 }}>© 2026 Photiades Group · Workflow Portal</div>
        </div>
      </div>
    </div>
  );
}
