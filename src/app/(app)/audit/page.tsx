import { AuditView } from '@/views/AuditView';
import { getAuditEvents } from '@/lib/server/audit';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page() {
  await requireModuleAccess('audit');
  const initialEvents = await getAuditEvents();
  return <AuditView initialEvents={initialEvents} />;
}
