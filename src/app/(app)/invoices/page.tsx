import { InvoicesView } from '@/views/InvoicesView';
import { getInvoices } from '@/lib/server/invoices';

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const invoices = await getInvoices();
  return <InvoicesView initialInvoices={invoices} initialId={id ?? null} />;
}
