import type { AttendanceToday } from '@/lib/validations';
import { CircleCheck, Clock, Plane, UserRoundX } from 'lucide-react';
import { cn } from '@/lib/client/utils';

export const PRESENCE_SEGMENTS = [
  { key: 'onTime', label: 'On time', icon: CircleCheck, bar: 'bg-success', text: 'text-success-text' },
  { key: 'late', label: 'Late', icon: Clock, bar: 'bg-warning', text: 'text-warning-text' },
  { key: 'onLeave', label: 'On leave', icon: Plane, bar: 'bg-chart-context', text: 'text-muted-foreground' },
  { key: 'notCheckedIn', label: 'Not checked in', icon: UserRoundX, bar: 'bg-destructive', text: 'text-danger-text' },
] as const;

/**
 * Where everyone is today, as one part-to-whole bar. Status colors always come with an icon and a
 * label (dataviz: status is never color alone), and segments are separated by a 2px gap.
 */
export function PresenceBar({ attendance }: { attendance: AttendanceToday }) {
  const segments = PRESENCE_SEGMENTS.map((segment) => ({ ...segment, value: attendance[segment.key] }));
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        {total === 0 ? (
          <div className="h-full w-full rounded-full bg-muted" />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => <div key={s.key} className={cn('h-full first:rounded-l-full last:rounded-r-full', s.bar)} style={{ flexGrow: s.value, flexBasis: 0 }} />)
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <s.icon className={cn('size-4 shrink-0', s.text)} aria-hidden />
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="ml-auto text-sm font-semibold tabular">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
