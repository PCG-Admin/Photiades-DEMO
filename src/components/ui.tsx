'use client';

/* Shared UI components */
import * as React from 'react';
import { useState, useEffect, useId } from 'react';
import { I, IconComponent } from './icons';
import { cx, fmtMoney, TONE_VAR } from '@/lib/utils';
import { useTr } from '@/lib/i18n';

export { cx, fmtMoney };

// Compact stat card with a colored left border (used across modules)
export function MiniStat({ label, value, sub, tone }: {
  label: string; value: React.ReactNode; sub?: string; tone: string;
}) {
  const toneVar = TONE_VAR[tone] ?? 'var(--accent)';
  return (
    <div className="card ministat" style={{ padding: '15px 18px', borderLeft: `3px solid ${toneVar}` }}>
      <div className="muted" style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 650, marginTop: 6, fontFamily: 'var(--mono)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function Badge({ tone = 'gray', dot, children }: { tone?: string; dot?: boolean; children: React.ReactNode }) {
  return <span className={cx('badge', tone)}>{dot && <span className="bdot" />}{children}</span>;
}

// Status → tone mapping
export const STATUS_TONE: Record<string, string> = {
  Approved: 'green', Paid: 'green', Completed: 'green', Active: 'green', Verified: 'green', Matched: 'green', 'Paid Invoice': 'green',
  Pending: 'amber', 'In Review': 'amber', Processing: 'amber', 'Awaiting Approval': 'amber', Captured: 'amber', 'On Hold': 'amber', 'Pending Payment': 'amber', 'At AcDep': 'amber',
  Rejected: 'red', Failed: 'red', Overdue: 'red', Error: 'red', Exception: 'red', Mismatch: 'red', 'Order not placed via PD': 'gray',
  Draft: 'gray', Archived: 'gray', Inactive: 'gray', Queued: 'gray',
  Extracting: 'violet', Classifying: 'violet', OCR: 'violet',
  New: 'blue', Submitted: 'blue', Scanned: 'teal',
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || 'gray'} dot>{status}</Badge>;
}

const AVATAR_COLORS = ['#3b5bdb', '#0c8599', '#e8590c', '#5f3dc4', '#2b8a3e', '#c2255c', '#1864ab', '#9c6b1e', '#0b7285'];
export function Avatar({ name, size = 34 }: { name: string; size?: number; src?: string }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.37 }}>
      {initials}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />;
}

export function IconBtn({ icon, badge, onClick, title }: { icon: IconComponent; badge?: boolean; onClick?: () => void; title?: string }) {
  const Ico = icon;
  return (
    <button className="icon-btn" onClick={onClick} title={title}>
      <Ico size={19} />
      {badge && <span className="dot-badge" />}
    </button>
  );
}

export function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cx('checkbox', checked && 'on')} onClick={(e) => { e.stopPropagation(); onChange(!checked); }}>
      {checked && <I.check size={13} stroke={3} />}
    </div>
  );
}

export type SegOption = string | { value: string | number; label: string };
export function Segmented({ options, value, onChange }: { options: SegOption[]; value: string | number; onChange: (v: string | number) => void }) {
  const valOf = (o: SegOption) => (typeof o === 'object' ? o.value : o);
  const labOf = (o: SegOption) => (typeof o === 'object' ? o.label : o);
  return (
    <div className="seg">
      {options.map(o => (
        <button key={String(valOf(o))} className={cx(value === valOf(o) && 'on')}
          onClick={() => onChange(valOf(o))}>{labOf(o)}</button>
      ))}
    </div>
  );
}

// KPI card
export function Kpi({ label, value, delta, deltaDir, icon, tone = 'blue', sub }: {
  label: string; value: React.ReactNode; delta?: string; deltaDir?: 'up' | 'down';
  icon?: IconComponent; tone?: string; sub?: string;
}) {
  const Ico = icon;
  const toneVar = ({ blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)', red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)' } as Record<string, string>)[tone];
  return (
    <div className="card kpi" style={{ '--kpi-tone': toneVar } as React.CSSProperties}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="kpi-label">{label}</div>
        {Ico && <div className="kpi-icon"><Ico size={17} /></div>}
      </div>
      <div className="kpi-val">{value}</div>
      <div className="row" style={{ gap: 8 }}>
        {delta != null && (
          <span className={cx('kpi-delta', deltaDir === 'down' ? 'down' : 'up')}>
            {deltaDir === 'down' ? <I.arrowDown /> : <I.arrowUp />}{delta}
          </span>
        )}
        {sub && <span className="faint" style={{ fontSize: 12 }}>{sub}</span>}
      </div>
    </div>
  );
}

export interface BarDatum { label: string; value: number; color?: string }
// Simple bar chart (SVG)
export function BarChart({ data, height = 180, color = 'var(--accent)', valueFmt = (v: number) => String(v) }: {
  data: BarDatum[]; height?: number; color?: string; valueFmt?: (v: number) => React.ReactNode;
}) {
  const max = Math.max(...data.map(d => d.value)) * 1.15;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '8px 0' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', flex: 1 }}>
              {hover === i && (
                <div style={{ position: 'absolute', bottom: `calc(${(d.value / max) * 100}% + 6px)`, background: 'var(--text)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 2 }}>
                  {valueFmt(d.value)}
                </div>
              )}
              <div style={{
                width: '72%', maxWidth: 38, borderRadius: '5px 5px 0 0',
                height: `${(d.value / max) * 100}%`,
                background: hover === i ? 'var(--accent-strong)' : (d.color || color),
                transition: 'height 0.6s cubic-bezier(0.22,1,0.36,1), background 0.15s',
                minHeight: 3,
              }} />
            </div>
            <div className="faint" style={{ fontSize: 11, fontWeight: 500 }}>{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DonutDatum { label: string; value: number; color?: string }
// Donut chart
export function Donut({ data, size = 150, thickness = 22 }: { data: DonutDatum[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  // Cumulative dash offset for each segment, computed without mutation.
  const offsets = data.map((_, i) => data.slice(0, i).reduce((s, d) => s + (d.value / total) * c, 0));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * c;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offsets[i]}
              strokeLinecap="butt" style={{ transition: 'stroke-dasharray 0.6s' }} />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
            <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{d.label}</span>
            <span className="mono tnum" style={{ marginLeft: 'auto', fontWeight: 600 }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sparkline / line chart
export function LineChart({ data, height = 70, color = 'var(--accent)', fill = true }: {
  data: number[]; height?: number; color?: string; fill?: boolean;
}) {
  const w = 100, max = Math.max(...data), min = Math.min(...data);
  const range_ = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - ((v - min) / range_) * (height - 10) - 5]);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${w} ${height} L0 ${height} Z`;
  const id = 'g' + useId().replace(/[:]/g, '');
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Modal
export function Modal({ title, sub, children, onClose, footer, width }: {
  title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode;
  onClose: () => void; footer?: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : {}} onClick={e => e.stopPropagation()}>
        <div className="card-head">
          <div>
            <div className="card-title">{title}</div>
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={18} /></button>
        </div>
        <div style={{ padding: 'var(--gap-5)' }}>{children}</div>
        {footer && <div style={{ padding: 'var(--gap-4) var(--gap-5)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

// Drawer
export function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">{children}</div>
    </>
  );
}

// Page header — auto-translates string titles/subtitles via the current language.
export function PageHeader({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  const tr = useTr();
  const T = (v: React.ReactNode) => (typeof v === 'string' ? tr(v) : v);
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--gap-6)', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{T(title)}</h2>
        {sub && <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>{T(sub)}</p>}
      </div>
      {actions && <div className="row" style={{ gap: 10 }}>{actions}</div>}
    </div>
  );
}

export function Toast({ msg, icon }: { msg: string; icon?: IconComponent }) {
  const Ico = icon || I.check;
  return (
    <div className="toast-wrap">
      <div className="toast"><Ico size={16} />{msg}</div>
    </div>
  );
}
