import { WorkflowsView } from '@/views/WorkflowsView';
import { getWorkflowInstancesWithInvoices } from '@/lib/server/workflows';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  await requireModuleAccess('workflows');
  const { open } = await searchParams;
  const initialInstances = await getWorkflowInstancesWithInvoices();
  return <WorkflowsView initialInstances={initialInstances} initialOpen={open ?? null} />;
}
