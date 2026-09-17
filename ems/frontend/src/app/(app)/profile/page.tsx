import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'My profile' };

export default function Page() {
  return (
    <ModulePage
      title="My profile"
      description="Your details. You can update your phone, address, emergency contact and photo."
      phase={3}
    />
  );
}
