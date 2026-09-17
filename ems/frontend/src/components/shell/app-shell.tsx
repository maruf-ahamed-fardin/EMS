'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { usePermissions } from '@/components/auth/permissions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HOME_PATH, SIDEBAR_COOKIE } from '@/lib/auth-paths';
import { activeItem, visibleNavigation } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { BrandMark } from './brand-mark';
import { SidebarNav } from './sidebar-nav';
import { type ShellUser, UserMenu } from './user-menu';

interface AppShellProps {
  user: ShellUser;
  initiallyCollapsed: boolean;
  children: React.ReactNode;
}

/**
 * Desktop (≥1024px): 248px sidebar that collapses to a 64px rail, remembered in a cookie.
 * Tablet (768–1023px): the rail. Mobile (<768px): a drawer opened from the header.
 */
export function AppShell({ user, initiallyCollapsed, children }: AppShellProps) {
  const permissions = usePermissions();
  const pathname = usePathname();
  const groups = useMemo(() => visibleNavigation(permissions), [permissions]);
  const active = activeItem(groups, pathname);

  const [collapsed, setCollapsed] = useState(initiallyCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-16 lg:w-62',
        )}
      >
        <Link
          href={HOME_PATH}
          className={cn('flex h-14 items-center gap-2.5 px-4', collapsed ? 'justify-center px-0' : 'max-lg:justify-center max-lg:px-0')}
        >
          <BrandMark />
          <span className={cn('leading-tight', collapsed ? 'hidden' : 'hidden lg:block')}>
            <span className="block text-sm font-bold">SeloraX</span>
            <span className="block text-[11px] text-muted-foreground">People</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <SidebarNav groups={groups} active={active} variant="rail" collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
              <SheetHeader className="flex-row items-center gap-2.5 border-b px-4 py-3">
                <BrandMark />
                <div>
                  <SheetTitle className="text-sm font-bold">SeloraX People</SheetTitle>
                  <SheetDescription className="text-xs">{user.roleName}</SheetDescription>
                </div>
              </SheetHeader>
              <div className="overflow-y-auto px-2.5 pb-6">
                <SidebarNav groups={groups} active={active} variant="full" onNavigate={() => setDrawerOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>

          <p className="truncate text-sm font-semibold md:text-base">{active?.label ?? 'SeloraX People'}</p>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu user={user} />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
