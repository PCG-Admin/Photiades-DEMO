import { ApprovalsView } from '@/views/ApprovalsView';
import { getApprovalsInbox } from '@/lib/server/workflows';
import { getCurrentAppUser } from '@/lib/server/users';

export default async function Page() {
  const user = await getCurrentAppUser();
  const initialItems = await getApprovalsInbox(user.role);
  return <ApprovalsView initialItems={initialItems} />;
}
