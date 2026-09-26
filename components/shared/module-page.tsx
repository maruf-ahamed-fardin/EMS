import { Construction, Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HOME_PATH } from '@/lib/client/auth-paths';
import { meetsAny, type Requirement } from '@/lib/client/navigation';
import { getSession } from '@/lib/client/session';
import { PageHeader } from './page-header';
import { StatePanel } from './state-panel';

/**
 * A guarded route whose module is built in a later phase. The permission check is the same one
 * the real page will use; only the body is a placeholder. Each phase replaces its pages.
 */
export async function ModulePage({
  title,
  description,
  phase,
  anyOf,
}: {
  title: string;
  description: string;
  phase: number;
  anyOf?: readonly Requirement[];
}) {
  const session = await getSession();
  if (!session || !meetsAny(session.permissions, anyOf)) return <Forbidden />;

  return (
    <>
      <PageHeader title={title} description={description} />
      <StatePanel
        icon={Construction}
        tone="brand"
        role="status"
        title={`${title} arrives in Phase ${phase}`}
        description="The route, navigation and access rules are in place. The screens are built in the phase named above, following docs/plan.md."
      />
    </>
  );
}

export function Forbidden() {
  return (
    <StatePanel
      icon={Lock}
      tone="warning"
      role="alert"
      title="You don't have access to this page"
      description="Your role doesn't include the permission this page needs. If you think it should, ask an HR administrator."
      action={
        <Button asChild variant="outline">
          <Link href={HOME_PATH}>Back to dashboard</Link>
        </Button>
      }
    />
  );
}
