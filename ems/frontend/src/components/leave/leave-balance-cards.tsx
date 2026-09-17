import type { LeaveBalanceRow } from '@ems/contracts';
import { daysLabel } from '@/lib/leave';

/** Each balance as a meter: used and pending against the allowance, with the number left in words. */
export function LeaveBalanceCards({ balances, actions }: { balances: LeaveBalanceRow[]; actions?: (balance: LeaveBalanceRow) => React.ReactNode }) {
  if (balances.length === 0) return <p className="text-sm text-muted-foreground">No leave balances for this year yet.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => {
        const total = Math.max(b.allocated + b.carriedForward, 1);
        return (
          <li key={b.id} className="rounded-2xl border bg-card p-4 shadow-panel">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{b.leaveType.name}</p>
              {actions?.(b)}
            </div>
            <p className="mt-1 text-3xl font-bold tracking-tight tabular">
              {b.available}
              <span className="ml-1.5 text-sm font-medium text-muted-foreground">of {b.allocated + b.carriedForward} left</span>
            </p>
            <div className="mt-3 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${b.used} used, ${b.pending} pending, ${b.available} available`}>
              {b.used > 0 && <div className="h-full bg-chart-1" style={{ width: `${(b.used / total) * 100}%` }} />}
              {b.pending > 0 && <div className="h-full bg-chart-1/45" style={{ width: `${(b.pending / total) * 100}%` }} />}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {daysLabel(b.used)} used{b.pending > 0 ? ` · ${daysLabel(b.pending)} waiting` : ''}
              {b.carriedForward > 0 ? ` · ${daysLabel(b.carriedForward)} carried over` : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
