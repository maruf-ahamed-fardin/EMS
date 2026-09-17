import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Reports' };

export default function Page() {
  return (
    <ModulePage
      title="Reports"
      description="Employee, attendance, leave and department reports, with export."
      phase={10}
      anyOf={[['report.view']]}
    />
  );
}
