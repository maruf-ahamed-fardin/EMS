'use client';

import {
  ATTENDANCE_STATUS_LABELS,
  AttendanceStatus,
  EMPLOYEE_STATUS_LABELS,
  EmployeeStatus,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  LEAVE_STATUS_LABELS,
  LeaveRequestStatus,
  type ReportKey,
} from '@/lib/validations';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REPORT_FILTERS, reportsHref } from '@/lib/client/reports';

const ANY = '__any__';

type Option = { value: string; label: string };

const DATE_LABELS: Record<string, string> = { from: 'From', to: 'To', joinedFrom: 'Joined from', joinedTo: 'Joined to' };

/** The filters for one report. Every change goes into the URL, so the server renders the new preview. */
export function ReportFilters({
  report,
  values,
  departments,
  leaveTypes,
}: {
  report: ReportKey;
  values: Record<string, string>;
  departments: Option[];
  leaveTypes: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (name: string, value: string | undefined) => {
    const next = { ...values };
    if (value) next[name] = value;
    else delete next[name];
    startTransition(() => router.replace(reportsHref(report, next), { scroll: false }));
  };

  const choices: Record<string, { label: string; any: string; options: Option[] }> = {
    departmentId: { label: 'Department', any: 'All departments', options: departments },
    leaveTypeId: { label: 'Leave type', any: 'All types', options: leaveTypes },
    employmentType: { label: 'Employment type', any: 'All types', options: EmploymentType.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABELS[t] })) },
    status: {
      label: 'Status',
      any: 'Any status',
      options:
        report === 'employees'
          ? EmployeeStatus.map((s) => ({ value: s, label: EMPLOYEE_STATUS_LABELS[s] }))
          : report === 'attendance'
            ? AttendanceStatus.map((s) => ({ value: s, label: ATTENDANCE_STATUS_LABELS[s] }))
            : LeaveRequestStatus.map((s) => ({ value: s, label: LEAVE_STATUS_LABELS[s] })),
    },
  };

  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:flex-wrap sm:items-end" aria-busy={pending}>
      {REPORT_FILTERS[report].map((name) => {
        const id = `report-${name}`;
        if (name in DATE_LABELS) {
          return (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={id} className="text-xs">
                {DATE_LABELS[name]}
              </Label>
              <Input id={id} type="date" className="h-10 sm:w-40" value={values[name] ?? ''} onChange={(e) => go(name, e.target.value || undefined)} />
            </div>
          );
        }
        const choice = choices[name]!;
        return (
          <div key={name} className="flex flex-col gap-1.5">
            <Label className="text-xs" id={`${id}-label`}>
              {choice.label}
            </Label>
            <Select value={values[name] ?? ANY} onValueChange={(value) => go(name, value === ANY ? undefined : value)}>
              <SelectTrigger className="h-10 w-full sm:w-48" aria-labelledby={`${id}-label`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{choice.any}</SelectItem>
                {choice.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      {pending && <LoaderCircle className="mb-3 size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
    </div>
  );
}
