'use client';

import type { DataResponse, MyAttendanceToday } from '@ems/contracts';
import { LoaderCircle, LogIn, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import { formatDuration, formatTime } from '@/lib/attendance';
import { AttendanceStatusBadge } from './attendance-status-badge';

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Dhaka' });

/**
 * Check in and out for yourself. The time is taken by the server when the button is pressed; the
 * clock shown here is only a guide.
 */
export function CheckInCard({ initial }: { initial: MyAttendanceToday }) {
  const router = useRouter();
  const [today, setToday] = useState(initial);
  const [pending, setPending] = useState<'in' | 'out' | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Starts on the first tick, so the server render and the first client render agree
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function punch(kind: 'in' | 'out') {
    setPending(kind);
    try {
      const { data } = await api<DataResponse<MyAttendanceToday>>(`/attendance/check-${kind}`, { method: 'POST' });
      setToday(data);
      toast.success(
        kind === 'in'
          ? `Checked in at ${formatTime(data.attendance?.firstInAt ?? null)}${data.attendance?.status === 'LATE' ? ' (late)' : ''}`
          : `Checked out at ${formatTime(data.attendance?.lastOutAt ?? null)}`,
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setPending(null);
    }
  }

  const a = today.attendance;
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel md:p-6" aria-labelledby="check-in-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="check-in-title" className="text-sm text-muted-foreground">
            Your day
          </h2>
          <p className="mt-1 font-mono text-3xl font-semibold tabular" suppressHydrationWarning>
            {now ? CLOCK.format(now) : ' '}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {today.onLeave
              ? "You're on approved leave today."
              : !today.isWorkingDay
                ? 'Not a working day, but you can still check in.'
                : `Check-ins after ${today.lateAfter} count as late.`}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {today.canCheckIn && (
            <Button size="lg" className="h-12 min-w-40 text-base" onClick={() => void punch('in')} disabled={pending !== null}>
              {pending === 'in' ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogIn aria-hidden />} Check in
            </Button>
          )}
          {today.canCheckOut && (
            <Button size="lg" variant="outline" className="h-12 min-w-40 text-base" onClick={() => void punch('out')} disabled={pending !== null}>
              {pending === 'out' ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogOut aria-hidden />} Check out
            </Button>
          )}
          {!today.canCheckIn && !today.canCheckOut && today.reason && <p className="text-sm text-muted-foreground">{today.reason}</p>}
        </div>
      </div>

      {a?.firstInAt && (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <AttendanceStatusBadge status={a.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Checked in</dt>
            <dd className="mt-1 font-semibold tabular">{formatTime(a.firstInAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Checked out</dt>
            <dd className="mt-1 font-semibold tabular">{formatTime(a.lastOutAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{a.status === 'LATE' ? 'Late by' : 'Worked'}</dt>
            <dd className="mt-1 font-semibold tabular">{a.status === 'LATE' && !a.lastOutAt ? formatDuration(a.lateMinutes) : formatDuration(a.workedMinutes)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
