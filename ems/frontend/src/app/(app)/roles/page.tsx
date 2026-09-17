import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default function Page() {
  return (
    <ModulePage
      title="Roles & permissions"
      description="What each role can see and do."
      phase={12}
      anyOf={[['role.manage']]}
    />
  );
}
