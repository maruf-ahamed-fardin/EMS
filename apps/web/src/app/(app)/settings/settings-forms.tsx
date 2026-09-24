'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AttendanceSettings, createHolidayInput, type CreateHolidayInput, type DataResponse, type HolidayItem } from '@ems/contracts';
import { CalendarPlus, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { DeleteButton } from '@/components/shared/delete-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { WEEKDAY_NAMES } from '@/lib/attendance';
import { formatDate } from '@/lib/employees';
import { applyApiError } from '@/lib/form-errors';
import { cn } from '@/lib/utils';

/**
 * The screens show dates and times in Dhaka time, so that is the only zone offered: a different one
 * would make "today" on screen disagree with the API. Supporting others needs the formatters in
 * `lib/` to take the zone from these settings.
 */
const TIME_ZONE = 'Asia/Dhaka';

const settingsSchema = z.object({
  timeZone: z.string().min(1, 'Choose a time zone'),
  weekendDays: z.array(z.number().int().min(0).max(6)).max(6, 'At least one day a week must be a working day'),
  workdayStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm'),
  graceMinutes: z.coerce.number<string | number>().int('Use whole minutes').min(0, 'Use 0 or more minutes').max(240, 'Keep it under 4 hours'),
});
type SettingsValues = z.input<typeof settingsSchema>;

export function AttendanceSettingsForm({ initial }: { initial: AttendanceSettings }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema), defaultValues: initial });
  // A zone stored earlier that the screens don't use: saving switches it, and the form says so
  const zoneMismatch = initial.timeZone !== TIME_ZONE;
  useEffect(() => {
    if (zoneMismatch) setValue('timeZone', TIME_ZONE, { shouldDirty: true });
  }, [zoneMismatch, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { data } = await api<DataResponse<AttendanceSettings>>('/settings/attendance', { method: 'PATCH', body: values });
      reset(data);
      toast.success('Attendance settings saved. They apply to check-ins from now on.');
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['timeZone', 'weekendDays', 'workdayStart', 'graceMinutes']));
    }
  });

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader>
        <CardTitle>Working day</CardTitle>
        <CardDescription>Changes apply from now on. Past attendance keeps the status it was given.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-5">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label htmlFor="time-zone" className="text-sm font-medium">
                Time zone
              </label>
              <input id="time-zone" readOnly value={`${TIME_ZONE} (Bangladesh)`} className="h-11 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground" aria-describedby="time-zone-hint" />
              <p id="time-zone-hint" className={cn('text-xs', zoneMismatch ? 'text-danger-text' : 'text-muted-foreground')}>
                {zoneMismatch ? `Saved as ${initial.timeZone}, but the app shows Bangladesh time. Save to switch.` : 'Dates and times across the app use Bangladesh time.'}
              </p>
            </div>
            <TextField label="Workday starts" type="time" required registration={register('workdayStart')} error={errors.workdayStart} />
            <TextField label="Grace period (minutes)" type="number" inputMode="numeric" min={0} max={240} required registration={register('graceMinutes')} error={errors.graceMinutes} />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Weekend days</legend>
            <Controller
              control={control}
              name="weekendDays"
              render={({ field, fieldState }) => (
                <>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_NAMES.map((name, day) => {
                      const selected = field.value.includes(day);
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => field.onChange(selected ? field.value.filter((d) => d !== day) : [...field.value, day].sort())}
                          className={cn(
                            'h-10 rounded-full border px-3.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                            selected ? 'border-primary/40 bg-accent text-accent-foreground' : 'hover:bg-secondary',
                          )}
                        >
                          {name.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {fieldState.error?.message && <p className="mt-2 text-sm text-danger-text">{fieldState.error.message}</p>}
                </>
              )}
            />
          </fieldset>

          <div>
            <Button type="submit" className="h-11" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Save working day
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function HolidaysCard({ year, initial }: { year: number; initial: HolidayItem[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateHolidayInput>({ resolver: zodResolver(createHolidayInput), defaultValues: { date: '', name: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api<DataResponse<HolidayItem>>('/holidays', { method: 'POST', body: values });
      reset({ date: '', name: '' });
      toast.success(`${values.name} added`);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['date', 'name']));
    }
  });

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader>
        <CardTitle>Holidays {year}</CardTitle>
        <CardDescription>Nobody is expected in on a holiday, and it doesn&rsquo;t count against leave. Adding one for a past day turns that day&rsquo;s absences into holidays.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <TextField label="Date" type="date" required registration={register('date')} error={errors.date} />
          <TextField label="Name" required placeholder="Victory Day" registration={register('name')} error={errors.name} />
          <Button type="submit" className="h-11" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden /> : <CalendarPlus aria-hidden />} Add
          </Button>
        </form>
        {formError && <FormAlert tone="error">{formError}</FormAlert>}

        {initial.length === 0 ? (
          <p className="text-sm text-muted-foreground">No holidays added for {year} yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {initial.map((holiday) => (
              <li key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="text-sm text-muted-foreground tabular">
                    {WEEKDAY_NAMES[new Date(`${holiday.date}T00:00:00Z`).getUTCDay()]}, {formatDate(holiday.date)}
                  </p>
                </div>
                <DeleteButton
                  size="icon"
                  label={`Delete ${holiday.name}`}
                  path={`/holidays/${holiday.id}`}
                  title={`Delete ${holiday.name}?`}
                  description="If the day has passed, its holiday attendance turns back into absences."
                  successMessage={`${holiday.name} removed`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
