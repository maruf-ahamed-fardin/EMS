import type { AttendanceStatus } from '@/lib/validations';
import { CalendarOff, CircleCheck, CircleX, Clock, Plane, Sun } from 'lucide-react';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/client/attendance';
import { cn } from '@/lib/client/utils';

const STYLE: Record<AttendanceStatus, { icon: typeof Clock; className: string }> = {
  PRESENT: { icon: CircleCheck, className: 'bg-success/12 text-success-text' },
  LATE: { icon: Clock, className: 'bg-warning/15 text-warning-text' },
  ABSENT: { icon: CircleX, className: 'bg-destructive/10 text-danger-text' },
  ON_LEAVE: { icon: Plane, className: 'bg-accent text-accent-foreground' },
  HOLIDAY: { icon: Sun, className: 'bg-muted text-muted-foreground' },
  WEEKEND: { icon: CalendarOff, className: 'bg-muted text-muted-foreground' },
};

/** Attendance status as icon + text + color, never color alone. */
export function AttendanceStatusBadge({ status, className }: { status: AttendanceStatus; className?: string }) {
  const { icon: Icon, className: tone } = STYLE[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {ATTENDANCE_STATUS_LABELS[status]}
    </span>
  );
}
