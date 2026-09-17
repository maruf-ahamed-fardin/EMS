import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Audit log' };

export default function Page() {
  return (
    <ModulePage
      title="Audit log"
      description="Who changed what, and when."
      phase={11}
      anyOf={[['audit.view']]}
    />
  );
}
