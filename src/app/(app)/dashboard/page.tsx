import { DashboardView } from '@/views/DashboardView';
import { getDashboardData } from '@/lib/server/dashboard';
import { getAuditEvents } from '@/lib/server/audit';

// No requireModuleAccess() guard here — /dashboard is requireModuleAccess()'s
// own redirect target for every other page, so gating it too would risk an
// infinite redirect loop if an admin ever unchecks it for a role.
export default async function Page() {
  const [data, recentActivity] = await Promise.all([getDashboardData(), getAuditEvents({ limit: 7 })]);
  return <DashboardView data={data} recentActivity={recentActivity} />;
}
