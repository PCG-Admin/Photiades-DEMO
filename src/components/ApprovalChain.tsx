'use client';

import { I } from '@/components/icons';
import { Badge } from '@/components/ui';
import { RelativeTime } from '@/components/RelativeTime';
import type { ChainStep } from '@/lib/constants';

// Vertical approval-chain timeline (shared by Invoice detail + Approvals)
export function ApprovalChain({ steps }: { steps: ChainStep[]; amount?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((s, i) => {
        const done = s.action === 'Approved' || s.action === 'Submitted';
        const active = s.action === 'Pending';
        return (
          <div key={i} style={{ display: 'flex', gap: 13, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 99, display: 'grid', placeItems: 'center', flexShrink: 0, zIndex: 1,
                background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--surface-3)',
                color: done || active ? 'white' : 'var(--faint)',
                border: active ? '2px solid var(--accent)' : 'none',
                boxShadow: active ? '0 0 0 4px var(--accent-ring)' : 'none',
              }}>
                {done ? <I.check size={15} stroke={3} /> : active ? <I.clock size={14} /> : <span style={{ fontSize: 12, fontWeight: 600 }}>{i + 1}</span>}
              </div>
              {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 22, background: done ? 'var(--green)' : 'var(--border)' }} />}
            </div>
            <div style={{ paddingBottom: i < steps.length - 1 ? 16 : 0, flex: 1 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                <span className="faint" style={{ fontSize: 11.5 }}>· {s.role}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 2 }}>
                <Badge tone={done ? 'green' : active ? 'blue' : 'gray'}>{s.action}</Badge>
                {s.when && <span className="faint" style={{ fontSize: 11.5 }}><RelativeTime date={s.when} /></span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
