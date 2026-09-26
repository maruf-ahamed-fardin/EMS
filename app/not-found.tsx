import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { StatePanel } from '@/components/shared/state-panel';
import { Button } from '@/components/ui/button';
import { HOME_PATH } from '@/lib/auth/constants';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <StatePanel
        className="w-full"
        icon={SearchX}
        title="We couldn't find that page"
        description="The link may be old, or the record may have been removed."
        action={
          <Button asChild>
            <Link href={HOME_PATH}>Go to the dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}
