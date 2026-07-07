import { AdminView } from '@/views/AdminView';
import { listAppUsers } from '@/lib/server/users';
import { listApproverMappings } from '@/lib/server/approverMappings';
import { listRolePermissions, requireModuleAccess } from '@/lib/server/permissions';

export default async function Page() {
  await requireModuleAccess('admin');
  const [initialUsers, initialMappings, initialPermissions] = await Promise.all([listAppUsers(), listApproverMappings(), listRolePermissions()]);
  return <AdminView initialUsers={initialUsers} initialMappings={initialMappings} initialPermissions={initialPermissions} />;
}
