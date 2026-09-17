import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PermissionsProvider } from '@/components/auth/permissions';
import { AppShell } from '@/components/shell/app-shell';
import { SIDEBAR_COOKIE } from '@/lib/auth-paths';
import { getSession } from '@/lib/session';

// Every page behind sign-in is per-user: never statically rendered or cached
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // The proxy only checks that a cookie exists; this checks that it is a valid session
  if (!session) redirect('/login');

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed';

  return (
    <PermissionsProvider permissions={session.permissions}>
      <AppShell
        user={{ name: session.name, email: session.email, roleName: session.roleName }}
        initiallyCollapsed={collapsed}
        preview={session.preview}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
