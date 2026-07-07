import { ReportsView } from '@/views/ReportsView';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page() {
  await requireModuleAccess('reports');
  return <ReportsView />;
}
