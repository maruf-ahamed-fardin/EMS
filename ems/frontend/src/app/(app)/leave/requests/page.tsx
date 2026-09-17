import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Leave requests' };

export default function Page() {
  return (
    <ModulePage
      title="Leave requests"
      description="Requests waiting for a decision."
      phase={7}
      anyOf={[['leave.approve']]}
    />
  );
}
