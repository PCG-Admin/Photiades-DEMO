import { AdminView } from '@/views/AdminView';
import { listAppUsers } from '@/lib/server/users';

export default async function Page() {
  const initialUsers = await listAppUsers();
  return <AdminView initialUsers={initialUsers} />;
}
