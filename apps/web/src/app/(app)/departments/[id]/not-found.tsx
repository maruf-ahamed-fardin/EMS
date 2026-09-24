import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { StatePanel } from '@/components/shared/state-panel';
import { Button } from '@/components/ui/button';

export default function DepartmentNotFound() {
  return (
    <StatePanel
      icon={Building2}
      title="We couldn't find this department"
      description="It may have been deleted."
      action={
        <Button asChild>
          <Link href="/departments">Back to departments</Link>
        </Button>
      }
    />
  );
}
