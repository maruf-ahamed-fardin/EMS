import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Employee profile' };

export default function Page() {
  return (
    <ModulePage
      title="Employee profile"
      description="Overview, personal and employment details, attendance, leave, documents and activity."
      phase={3}
      anyOf={[['employee.view']]}
    />
  );
}
