import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Add employee' };

export default function Page() {
  return (
    <ModulePage
      title="Add employee"
      description="Create an employee record and, optionally, their sign-in."
      phase={3}
      anyOf={[['employee.create']]}
    />
  );
}
