import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Leave types' };

export default function Page() {
  return (
    <ModulePage
      title="Leave types"
      description="The kinds of leave people can take and their yearly allowance."
      phase={7}
      anyOf={[['leave.manage_types']]}
    />
  );
}
