import { AuditView } from '@/views/AuditView';
import { getAuditEvents } from '@/lib/server/audit';

export default async function Page() {
  const initialEvents = await getAuditEvents();
  return <AuditView initialEvents={initialEvents} />;
}
