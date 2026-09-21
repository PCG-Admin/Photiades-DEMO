'use client';

import { PCG_DEMOS, PCG_DEMO_COOKIE, PCG_HANDOFF_PARAM, type DemoId } from '@/lib/pcg-demos';

export function PcgDemoSwitcher({ current }: { current: DemoId }) {
  function select(demo: (typeof PCG_DEMOS)[number]) {
    if (demo.id === current) {
      document.cookie = `${PCG_DEMO_COOKIE}=${demo.id}; Path=/; Max-Age=31536000; SameSite=Lax`;
      return;
    }
    // Cross-origin hop — a full navigation, never router.push. The destination
    // app reads ?pcg_demo= and writes the cookie into its own jar.
    const target = new URL(demo.url);
    target.searchParams.set(PCG_HANDOFF_PARAM, demo.id);
    window.location.assign(target.toString());
  }
  return <div role="group" aria-label="Switch PCG demo" style={{ display: 'inline-flex', padding: 3, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-soft)', overflowX: 'auto', flexShrink: 0 }}>
    {PCG_DEMOS.map(demo => <button key={demo.id} onClick={() => select(demo)} aria-current={demo.id === current ? 'page' : undefined}
      style={{ border: 0, borderRadius: 6, padding: '6px 10px', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 650, cursor: 'pointer', color: demo.id === current ? 'var(--accent-strong)' : 'var(--muted)', background: demo.id === current ? 'var(--surface)' : 'transparent', boxShadow: demo.id === current ? 'var(--shadow-sm)' : 'none' }}>
      {demo.label}
    </button>)}
  </div>;
}
