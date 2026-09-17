import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Leave' };

export default function Page() {
  return (
    <ModulePage
      title="Leave"
      description="Your balances and requests."
      phase={7}
      anyOf={[['leave.create']]}
    />
  );
}
