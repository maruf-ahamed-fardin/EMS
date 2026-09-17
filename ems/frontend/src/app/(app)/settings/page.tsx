import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return (
    <ModulePage
      title="Settings"
      description="Organization, working calendar and leave settings."
      phase={12}
      anyOf={[['settings.manage']]}
    />
  );
}
