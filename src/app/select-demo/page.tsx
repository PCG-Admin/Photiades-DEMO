'use client';

import { PCG_DEMOS, PCG_HANDOFF_PARAM } from '@/lib/pcg-demos';

export default function SelectDemoPage() {
  function choose(demo: (typeof PCG_DEMOS)[number]) {
    // Cross-origin hop. The destination app reads ?pcg_demo= and writes the
    // cookie into ITS OWN jar; writing it here would only stamp another
    // app's id into this one.
    const target = new URL(demo.url); target.searchParams.set(PCG_HANDOFF_PARAM, demo.id); window.location.assign(target.toString());
  }
  return <main style={{ minHeight: '100vh', background: '#081226', color: '#fff', padding: '64px 20px' }}>
    <section style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ width: 58, height: 58, borderRadius: 16, display: 'grid', placeItems: 'center', margin: '0 auto 18px', background: '#3157d5', fontWeight: 800 }}>PCG</div>
        <p style={{ color: '#91a7ed', fontSize: 12, fontWeight: 700, letterSpacing: '.22em' }}>PCG DEMO</p>
        <h1 style={{ marginTop: 10, fontSize: 36 }}>Choose a demo</h1>
        <p style={{ color: '#99a6ba', marginTop: 10 }}>Select a workspace. You can switch again from the top navigation.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
        {PCG_DEMOS.map(demo => <button key={demo.id} onClick={() => choose(demo)} style={{ minHeight: 190, padding: 24, textAlign: 'left', color: '#fff', borderRadius: 16, border: '1px solid #31405a', background: '#101d33', cursor: 'pointer' }}>
          <span style={{ display: 'block', color: '#91a7ed', fontSize: 12, fontWeight: 700 }}>PCG DEMO</span>
          <strong style={{ display: 'block', marginTop: 42, fontSize: 20 }}>{demo.label} →</strong>
          <span style={{ display: 'block', marginTop: 9, color: '#99a6ba', lineHeight: 1.5 }}>{demo.description}</span>
        </button>)}
      </div>
    </section>
  </main>;
}
