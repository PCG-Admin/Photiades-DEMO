import type { Metadata } from 'next';
import Image from 'next/image';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in · PCG | MindRift Workflow Portal',
};

export default function LoginPage() {
  return (
<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, position: 'relative', overflow: 'hidden', background: 'var(--accent-strong)' }}>
  <div style={{ position: 'absolute', inset: -20, zIndex: 0, backgroundImage: "url('/images/login-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) saturate(0.7)', transform: 'scale(1.1)' }} />
  <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(160deg, rgba(13,29,65,0.72), rgba(7,18,48,0.8))' }} />
  <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 2 }}>
        <div className="card" style={{ padding: 28 }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 24 }}>
            <Image src="/images/Mindrift_Logo.jpg" alt="MindRift" width={160} height={117} style={{ objectFit: 'contain' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Welcome back</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>Sign in to continue to the portal.</p>
          </div>

          <LoginForm />

          <div className="faint" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 22 }}>© 2026 PCG | MindRift · Workflow Portal</div>
        </div>
      </div>
    </div>
  );
}
