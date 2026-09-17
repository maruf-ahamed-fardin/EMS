import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Documents' };

export default function Page() {
  return (
    <ModulePage
      title="Documents"
      description="Employee documents and upcoming expiry dates."
      phase={8}
      anyOf={[['document.view']]}
    />
  );
}
