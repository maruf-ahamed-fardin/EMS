import type { EmployeeStatus } from '@ems/contracts';
import { CircleCheck, CircleMinus } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/employees';
import { cn } from '@/lib/utils';

/** Status as icon + text + colour, never colour alone (plan §12, accessibility). */
export function StatusBadge({ status, className }: { status: EmployeeStatus; className?: string }) {
  const active = status === 'ACTIVE';
  const Icon = active ? CircleCheck : CircleMinus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        active ? 'bg-success/12 text-success-text' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs font-medium whitespace-nowrap text-accent-foreground', className)}>
      {children}
    </span>
  );
}
