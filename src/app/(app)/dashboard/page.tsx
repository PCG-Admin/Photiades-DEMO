import { DashboardView } from '@/views/DashboardView';
import { getDashboardData } from '@/lib/server/dashboard';
import { getAuditEvents } from '@/lib/server/audit';

export default async function Page() {
  const [data, recentActivity] = await Promise.all([getDashboardData(), getAuditEvents({ limit: 7 })]);
  return <DashboardView data={data} recentActivity={recentActivity} />;
}
