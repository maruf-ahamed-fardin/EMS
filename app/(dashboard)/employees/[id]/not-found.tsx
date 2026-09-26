import { UserSearch } from 'lucide-react';
import Link from 'next/link';
import { StatePanel } from '@/components/shared/state-panel';
import { Button } from '@/components/ui/button';

export default function EmployeeNotFound() {
  return (
    <StatePanel
      icon={UserSearch}
      title="We couldn't find this employee"
      description="The record may have been deleted, or it isn't one you have access to."
      action={
        <Button asChild>
          <Link href="/employees">Back to employees</Link>
        </Button>
      }
    />
  );
}
