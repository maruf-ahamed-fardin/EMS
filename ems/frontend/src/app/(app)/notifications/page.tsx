import type { Metadata } from 'next';
import { ModulePage } from '@/components/shared/module-page';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return (
    <ModulePage
      title="Notifications"
      description="Everything that needs your attention."
      phase={9}
    />
  );
}
