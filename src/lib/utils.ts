export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');
export const fmtMoney = (n: number, cur = '€') =>
  cur + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtNum = (n: number) => n.toLocaleString('en-US');

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal' | 'gray';

export const TONE_VAR: Record<string, string> = {
  blue: 'var(--accent)', green: 'var(--green)', amber: 'var(--amber)',
  red: 'var(--red)', violet: 'var(--violet)', teal: 'var(--teal)', gray: 'var(--muted)',
};
export const SOFT_VAR: Record<string, string> = {
  blue: 'var(--accent-soft)', green: 'var(--green-soft)', amber: 'var(--amber-soft)',
  red: 'var(--red-soft)', violet: 'var(--violet-soft)', teal: 'var(--teal-soft)', gray: 'var(--surface-3)',
};
