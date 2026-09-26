'use client';

import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NavGroup, NavItem } from '@/lib/client/navigation';
import { cn } from '@/lib/client/utils';

interface SidebarNavProps {
  groups: readonly NavGroup[];
  active: NavItem | undefined;
  /**
   * `rail`: icons only below 1024px, and on wider screens too when `collapsed`.
   * `full`: always labelled (the mobile drawer).
   */
  variant: 'rail' | 'full';
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ groups, active, variant, collapsed = false, onNavigate }: SidebarNavProps) {
  // Classes that show an element only where the rail is expanded (desktop, not collapsed)
  const whenExpanded = variant === 'full' ? '' : collapsed ? 'hidden' : 'hidden lg:inline';
  const whenExpandedBlock = variant === 'full' ? '' : collapsed ? 'hidden' : 'hidden lg:block';

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p
            className={cn(
              'px-2.5 pt-4 pb-1.5 text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase',
              whenExpandedBlock,
            )}
          >
            {group.label}
          </p>
          {variant === 'rail' && <div aria-hidden className={cn('mx-3 my-2 h-px bg-sidebar-border', collapsed ? '' : 'lg:hidden')} />}

          {group.items.map((item) => {
            const isActive = item.href === active?.href;
            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground transition-colors outline-none',
                  'hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  variant === 'rail' && (collapsed ? 'justify-center' : 'max-lg:justify-center'),
                )}
              >
                {isActive && (
                  <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-primary" />
                )}
                <item.icon className="size-[18px] shrink-0" aria-hidden />
                <span className={cn('truncate', whenExpanded)}>{item.label}</span>
                {variant === 'rail' && <span className={cn('sr-only', collapsed ? '' : 'lg:hidden')}>{item.label}</span>}
              </Link>
            );

            if (variant === 'full') return <div key={item.href}>{link}</div>;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className={collapsed ? '' : 'lg:hidden'}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
