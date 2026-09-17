import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Employees' };

export default function Page() {
  return (
    <ModulePage
      title="Employees"
      description="Everyone in the organization, with search and filters."
      phase={3}
      anyOf={[['employee.view', 'TEAM']]}
    />
  );
}
