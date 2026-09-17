import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Positions' };

export default function Page() {
  return (
    <ModulePage
      title="Positions"
      description="Job titles and the departments they belong to."
      phase={4}
      anyOf={[['position.view']]}
    />
  );
}
