import { CaptureView } from '@/views/CaptureView';
import { requireModuleAccess } from '@/lib/server/permissions';

export default async function Page() {
  await requireModuleAccess('capture');
  return <CaptureView />;
}
