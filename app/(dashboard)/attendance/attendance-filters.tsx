'use client';

import { AttendanceStatus } from '@/lib/validations';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ATTENDANCE_STATUS_LABELS, attendanceHref } from '@/lib/client/attendance';

const ANY = '__any__';

/** Date range, status and department. Filters live in the URL, so the server renders the list. */
export function AttendanceFilters({
  params,
  departments,
}: {
  params: Record<string, string | undefined>;
  departments: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (changes: Record<string, string | undefined>) =>
    startTransition(() => router.replace(attendanceHref(params, changes), { scroll: false }));

  return (
    <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:flex-wrap md:items-end" aria-busy={pending}>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-from" className="text-xs">
            From
          </Label>
          <Input id="attendance-from" type="date" className="h-10" value={params.from ?? ''} max={params.to} onChange={(e) => e.target.value && go({ from: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-to" className="text-xs">
            To
          </Label>
          <Input id="attendance-to" type="date" className="h-10" value={params.to ?? ''} min={params.from} onChange={(e) => e.target.value && go({ to: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:ml-auto md:flex">
        <Select value={params.status ?? ANY} onValueChange={(value) => go({ status: value === ANY ? undefined : value })}>
          <SelectTrigger className="h-10 w-full md:w-40" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any status</SelectItem>
            {AttendanceStatus.map((status) => (
              <SelectItem key={status} value={status}>
                {ATTENDANCE_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {departments.length > 0 && (
          <Select value={params.departmentId ?? ANY} onValueChange={(value) => go({ departmentId: value === ANY ? undefined : value })}>
            <SelectTrigger className="h-10 w-full md:w-48" aria-label="Department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
