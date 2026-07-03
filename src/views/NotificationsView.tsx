'use client';

/* Notifications — SOW §4 in-scope module: "Email / in-app task alerts". */

import { useState } from 'react';
import { I } from '@/components/icons';
import { Badge, PageHeader, MiniStat, Segmented } from '@/components/ui';
import { RelativeTime } from '@/components/RelativeTime';
import { useToast } from '@/components/providers/ToastProvider';
import { TONE_VAR, SOFT_VAR } from '@/lib/utils';
import { markNotificationRead } from '@/lib/server/notifications';
import type { NotificationRow } from '@/lib/supabase/types';

const KIND_LABEL: Record<NotificationRow['kind'], string> = {
  task: 'Task', declined: 'Info requested', sla: 'SLA', system: 'System',
};

export function NotificationsView({ initialNotifications }: { initialNotifications: NotificationRow[] }) {
  const toast = useToast();
  const [items, setItems] = useState<NotificationRow[]>(initialNotifications);
  const [filter, setFilter] = useState('Unread');

  const unreadCount = items.filter(n => !n.read).length;
  const filtered = filter === 'Unread' ? items.filter(n => !n.read) : items;

  async function markRead(n: NotificationRow) {
    if (n.read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    await markNotificationRead(n.id);
  }

  async function markAllRead() {
    const unread = items.filter(n => !n.read);
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
    toast('All notifications marked as read');
  }

  return (
    <div className="view-enter">
      <PageHeader title="Notifications" sub="Task alerts, SLA warnings, and system messages."
        actions={<button className="btn" onClick={markAllRead}><I.check size={15} />Mark all read</button>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 'var(--gap-4)', marginBottom: 'var(--gap-5)' }}>
        <MiniStat label="Unread" value={unreadCount} tone="blue" />
        <MiniStat label="SLA warnings" value={items.filter(n => n.kind === 'sla').length} tone="amber" />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <Segmented options={['Unread', 'All']} value={filter} onChange={(v) => setFilter(String(v))} />
          <Badge tone="gray">{filtered.length}</Badge>
        </div>
        <div>
          {filtered.length === 0 && <div className="empty"><I.check size={32} /><div style={{ marginTop: 10 }}>You&apos;re all caught up!</div></div>}
          {filtered.map(n => {
            const Ico = (n.icon && I[n.icon]) || I.bell;
            const tone = n.tone ?? 'gray';
            return (
              <button key={n.id} onClick={() => markRead(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', textAlign: 'left', border: 'none',
                  borderBottom: '1px solid var(--border)', background: n.read ? 'transparent' : 'var(--accent-softer)',
                  padding: '14px 20px', cursor: 'pointer',
                }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: SOFT_VAR[tone], color: TONE_VAR[tone],
                }}>
                  <Ico size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{n.title}</span>
                    <span className="faint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}><RelativeTime date={new Date(n.created_at)} /></span>
                  </div>
                  {n.detail && <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{n.detail}</div>}
                  <div style={{ marginTop: 6 }}><Badge tone={tone}>{KIND_LABEL[n.kind]}</Badge></div>
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
