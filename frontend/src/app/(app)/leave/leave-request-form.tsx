'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateLeaveRequestInput, createLeaveRequestInput, type DataResponse, type LeavePreview, type LeaveTypeItem } from '@ems/contracts';
import { CircleAlert, CircleCheck, LoaderCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { dhakaToday } from '@/lib/attendance';
import { formatDate } from '@/lib/employees';
import { applyApiError } from '@/lib/form-errors';
import { daysLabel } from '@/lib/leave';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Request leave, with a live preview of the working days, the balance after, and anything that would stop it. */
export function LeaveRequestForm({ types }: { types: LeaveTypeItem[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; data: LeavePreview | null; error?: string } | null>(null);
  const today = dhakaToday();

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateLeaveRequestInput>({
    resolver: zodResolver(createLeaveRequestInput),
    defaultValues: { leaveTypeId: types[0]?.id ?? '', startDate: '', endDate: '', reason: '' },
  });
  const [leaveTypeId, startDate, endDate] = useWatch({ control, name: ['leaveTypeId', 'startDate', 'endDate'] });
  const ready = Boolean(leaveTypeId && DATE.test(startDate) && DATE.test(endDate) && endDate >= startDate);
  const key = `${leaveTypeId}|${startDate}|${endDate}`;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<DataResponse<LeavePreview>>('/leave/preview', { method: 'POST', body: { leaveTypeId, startDate, endDate } })
        .then(({ data }) => !cancelled && setPreview({ key, data }))
        .catch((error: unknown) => !cancelled && setPreview({ key, data: null, error: error instanceof Error ? error.message : 'Could not check these dates' }));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, key, leaveTypeId, startDate, endDate]);

  const current = ready && preview?.key === key ? preview : null;
  const blocked = Boolean(current?.data && current.data.problems.length > 0);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api('/leave/requests', { method: 'POST', body: values });
      toast.success('Leave requested. Your manager will be asked to approve it.');
      reset({ leaveTypeId: values.leaveTypeId, startDate: '', endDate: '', reason: '' });
      setPreview(null);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['leaveTypeId', 'endDate', 'reason']));
    }
  });

  if (types.length === 0) return <p className="text-sm text-muted-foreground">No leave types are set up yet. Ask HR.</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
      {formError && <FormAlert tone="error">{formError}</FormAlert>}
      <SelectField
        control={control}
        name="leaveTypeId"
        label="Type of leave"
        required
        options={types.map((t) => ({ value: t.id, label: t.name, hint: t.isPaid ? undefined : 'unpaid' }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="First day" type="date" required min={today} registration={register('startDate')} error={errors.startDate} />
        <TextField label="Last day" type="date" required min={startDate || today} registration={register('endDate')} error={errors.endDate} />
      </div>

      {ready && (
        <div className="rounded-xl border bg-secondary/50 p-3 text-sm" aria-live="polite">
          {!current ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> Counting working days…
            </p>
          ) : current.data ? (
            <div className="grid grid-cols-1 gap-1.5">
              <p className="flex items-center gap-2 font-medium">
                {blocked ? <CircleAlert className="size-4 text-danger-text" aria-hidden /> : <CircleCheck className="size-4 text-success-text" aria-hidden />}
                {daysLabel(current.data.days)} of leave
                {current.data.available !== null && (
                  <span className="font-normal text-muted-foreground">
                    · {current.data.available} available, {current.data.availableAfter} after
                  </span>
                )}
              </p>
              {current.data.excludedDays.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Not counted: {current.data.excludedDays.map((d) => `${formatDate(d.date)} (${d.reason})`).join(', ')}
                </p>
              )}
              {current.data.problems.map((problem) => (
                <p key={problem} className="text-danger-text">
                  {problem}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-danger-text">{current.error}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="leave-reason">
          Reason<span aria-hidden className="text-danger-text">*</span>
        </Label>
        <Textarea id="leave-reason" rows={3} placeholder="Family visit" aria-invalid={errors.reason ? true : undefined} {...register('reason')} />
        {errors.reason?.message && <p className="text-sm text-danger-text">{errors.reason.message}</p>}
      </div>

      <div>
        <Button type="submit" className="h-11" disabled={isSubmitting || blocked}>
          {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />} Request leave
        </Button>
      </div>
    </form>
  );
}
