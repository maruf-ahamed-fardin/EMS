import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PermissionsProvider } from '@/components/auth/permissions';
import { AppShell } from '@/components/shell/app-shell';
import { SIDEBAR_COOKIE } from '@/lib/auth-paths';
import { getSession } from '@/lib/session';

// Every page behind sign-in is per-user: never statically rendered or cached
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // The proxy only checks that a cookie exists; this checks that it is a valid session. Coming back
  // to the same page afterwards: the login page only follows same-site paths (safeNextPath).
  if (!session) {
    const here = (await headers()).get('x-pathname');
    redirect(here && here !== '/' ? `/login?next=${encodeURIComponent(here)}` : '/login');
  }

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed';

  return (
    <PermissionsProvider permissions={session.permissions}>
      <AppShell
        user={{ name: session.name, email: session.email, roleName: session.role.name }}
        initiallyCollapsed={collapsed}
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
