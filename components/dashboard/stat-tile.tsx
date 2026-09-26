import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/client/utils';

/** A KPI tile: label, one number, and a line of context (dataviz: a single value is a tile, not a chart). */
export function StatTile({
  icon: Icon,
  label,
  value,
  suffix,
  context,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  suffix?: string;
  context?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular">
        {value}
        {suffix && <span className="ml-1.5 text-base font-medium text-muted-foreground">{suffix}</span>}
      </p>
      {context && <p className="mt-1 text-xs text-muted-foreground">{context}</p>}
    </>
  );
  const className = 'rounded-2xl border bg-card p-4 shadow-panel md:p-5';
  return href ? (
    <Link href={href} className={cn(className, 'block transition-colors outline-none hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
