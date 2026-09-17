import { LayoutDashboard } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/shared/page-header';
import { StatePanel } from '@/components/shared/state-panel';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Dashboard' };

function greeting(now: Date): string {
  // The organization's time zone (plan D6); becomes a setting in Phase 6
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Dhaka' }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const session = await getSession();
  const firstName = session?.name.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`${greeting(new Date())}, ${firstName}`}
        description={new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'Asia/Dhaka' }).format(new Date())}
      />
      <StatePanel
        icon={LayoutDashboard}
        tone="brand"
        role="status"
        title="The dashboard arrives in Phase 5"
        description="Headcount, today's attendance, leave waiting for approval and recent activity will appear here once the modules that feed them exist."
      />
    </>
  );
}
