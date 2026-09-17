import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Attendance' };

export default function Page() {
  return (
    <ModulePage
      title="Attendance"
      description="Check in and out, and review attendance records."
      phase={6}
      anyOf={[['attendance.view'], ['attendance.self']]}
    />
  );
}
