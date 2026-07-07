import { InvoicesView } from '@/views/InvoicesView';
import { getInvoices } from '@/lib/server/invoices';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireModuleAccess('invoices');
  const { id } = await searchParams;
  const invoices = await getInvoices();
  return <InvoicesView initialInvoices={invoices} initialId={id ?? null} />;
}
