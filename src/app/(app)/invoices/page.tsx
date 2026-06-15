import { InvoicesView } from '@/views/InvoicesView';

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <InvoicesView initialId={id ?? null} />;
}
