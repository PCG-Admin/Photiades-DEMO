import { NotificationsView } from '@/views/NotificationsView';
import { getNotificationsForCurrentUser } from '@/lib/server/notifications';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page() {
  await requireModuleAccess('notifications');
  const initialNotifications = await getNotificationsForCurrentUser();
  return <NotificationsView initialNotifications={initialNotifications} />;
}
