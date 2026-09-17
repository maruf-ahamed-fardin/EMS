import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Users' };

export default function Page() {
  return (
    <ModulePage
      title="Users"
      description="Sign-in accounts and their roles."
      phase={12}
      anyOf={[['user.view']]}
    />
  );
}
