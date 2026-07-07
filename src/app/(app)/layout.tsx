import { AppShell } from '@/components/shell/AppShell';
import { CurrentUserProvider } from '@/components/providers/CurrentUserProvider';
import { getCurrentAppUser } from '@/lib/server/users';
import { getNotificationsForCurrentUser } from '@/lib/server/notifications';
import { getAccessibleModules } from '@/lib/server/permissions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, notifications] = await Promise.all([getCurrentAppUser(), getNotificationsForCurrentUser()]);
  const unreadCount = notifications.filter(n => !n.read).length;
  const accessibleModules = await getAccessibleModules(user.role);
  return (
    <CurrentUserProvider user={user}>
      <AppShell unreadCount={unreadCount} accessibleModules={[...accessibleModules]}>{children}</AppShell>
    </CurrentUserProvider>
  );
}
