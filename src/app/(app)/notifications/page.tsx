import { NotificationsView } from '@/views/NotificationsView';
import { getNotificationsForCurrentUser } from '@/lib/server/notifications';

export default async function Page() {
  const initialNotifications = await getNotificationsForCurrentUser();
  return <NotificationsView initialNotifications={initialNotifications} />;
}
