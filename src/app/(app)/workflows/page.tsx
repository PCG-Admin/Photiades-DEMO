import { WorkflowsView } from '@/views/WorkflowsView';
import { getWorkflowInstancesWithInvoices } from '@/lib/server/workflows';

export default async function Page({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const { open } = await searchParams;
  const initialInstances = await getWorkflowInstancesWithInvoices();
  return <WorkflowsView initialInstances={initialInstances} initialOpen={open ?? null} />;
}
