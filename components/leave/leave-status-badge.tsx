import type { LeaveRequestStatus } from '@/lib/validations';
import { Ban, CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { LEAVE_STATUS_LABELS } from '@/lib/client/leave';
import { cn } from '@/lib/utils/cn';

const STYLE: Record<LeaveRequestStatus, { icon: typeof Ban; className: string }> = {
  PENDING: { icon: Hourglass, className: 'bg-warning/15 text-warning-text' },
  APPROVED: { icon: CircleCheck, className: 'bg-success/12 text-success-text' },
  REJECTED: { icon: CircleX, className: 'bg-destructive/10 text-danger-text' },
  CANCELLED: { icon: Ban, className: 'bg-muted text-muted-foreground' },
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { icon: Icon, className } = STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}>
      <Icon className="size-3.5" aria-hidden />
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}
