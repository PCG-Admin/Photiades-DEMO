'use client';

import * as React from 'react';
import { I } from '@/components/icons';
import { StatusBadge } from '@/components/ui';
import { cx } from '@/lib/utils';

// Read-only meta field (shared by Capture + Invoice forms)
export function ReadField({ label, value, statusTone, dot, noBorder }: {
  label: string;
  value: string;
  statusTone?: boolean;
  dot?: string;
  noBorder?: boolean;
}) {
  return (
    <div style={{ padding: '12px 18px', borderRight: noBorder ? 'none' : '1px solid var(--border)' }}>
      <div className="row" style={{ gap: 5, marginBottom: 5 }}>
        <span className="muted" style={{ fontSize: 11 }}>{label}</span>
        <I.shield size={11} style={{ color: 'var(--faint)' }} />
      </div>
      {statusTone ? <StatusBadge status={value} /> : (
        <div className="row" style={{ gap: 7 }}>
          {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: dot }} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
        </div>
      )}
    </div>
  );
}

// Editable form-field wrapper with hover-to-locate + confidence hint (shared)
export function FF({ label, conf, hk, hoverField, setHoverField, span2, children }: {
  label: string;
  conf?: number;
  hk?: string;
  hoverField?: string | null;
  setHoverField?: (v: string | null) => void;
  span2?: boolean;
  children: React.ReactNode;
}) {
  const active = !!hk && hoverField === hk;
  return (
    <div
      style={{ gridColumn: span2 ? '1 / -1' : 'auto', borderRadius: 8, padding: active ? '6px 8px' : '6px 0', margin: active ? '-6px -8px' : 0, background: active ? 'var(--accent-softer)' : 'transparent', transition: 'background 0.12s' }}
      onMouseEnter={() => { if (hk) setHoverField?.(hk); }}
      onMouseLeave={() => { if (hk) setHoverField?.(null); }}
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-2)' }}>{label}</label>
        {conf != null && <span className={cx('mono')} style={{ fontSize: 10, fontWeight: 600, color: conf >= 90 ? 'var(--green)' : conf >= 75 ? 'var(--amber)' : 'var(--red)' }}>{conf}%{conf < 80 ? ' ⚠' : ''}</span>}
      </div>
      {children}
    </div>
  );
}
