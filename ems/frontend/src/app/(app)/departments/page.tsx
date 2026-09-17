import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Departments' };

export default function Page() {
  return (
    <ModulePage
      title="Departments"
      description="Departments, their heads and headcount."
      phase={4}
      anyOf={[['department.view']]}
    />
  );
}
