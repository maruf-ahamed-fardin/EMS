'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type AttendanceItem, AttendanceStatus, correctAttendanceInput, createAttendanceInput } from '@/lib/validations';
import { LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/client/api-client';
import { ATTENDANCE_STATUS_LABELS, dhakaToday, toClockInput } from '@/lib/client/attendance';
import { formatDate } from '@/lib/client/employees';
import { applyApiError } from '@/lib/client/form-errors';

// Form inputs are strings; empty ones mean "no time" or "no status" to the API
function normalize(raw: unknown) {
  const value = raw as Record<string, string | undefined>;
  return { ...value, firstIn: value.firstIn || null, lastOut: value.lastOut || null, status: value.status || undefined };
}
const correctSchema = z.preprocess(normalize, correctAttendanceInput);
const createSchema = z.preprocess(normalize, createAttendanceInput);

type Values = { employeeId?: string; workDate?: string; firstIn: string; lastOut: string; status?: string; note: string };

/**
 * Correct a record (`record` given) or add one for a day with none (`employees` given). Times are
 * wall-clock HH:mm in Dhaka; the API turns them into instants.
 */
export function CorrectionDialog({ record, employees }: { record?: AttendanceItem; employees?: Array<{ id: string; name: string; employeeCode: string }> }) {
  const router = useRouter();
  const creating = !record;
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaults: Values = record
    ? { firstIn: toClockInput(record.firstInAt), lastOut: toClockInput(record.lastOutAt), status: '', note: '' }
    : { employeeId: '', workDate: dhakaToday(), firstIn: '', lastOut: '', status: '', note: '' };

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    // Two schemas share the field names; the cast keeps react-hook-form's resolver typing simple
    resolver: zodResolver((creating ? createSchema : correctSchema) as unknown as z.ZodType<Values, Values>),
    defaultValues: defaults,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (record) {
        await api(`/attendance/${record.id}`, { method: 'PATCH', body: values });
        toast.success(`Corrected ${record.employee.name}'s attendance for ${formatDate(record.workDate)}`);
      } else {
        await api('/attendance', { method: 'POST', body: values });
        toast.success('Attendance record added');
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['employeeId', 'workDate', 'firstIn', 'lastOut', 'status', 'note']));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        // Filled from the record as it is now: after a save, the refreshed row has the corrected times
        if (next) reset(defaults);
        else setFormError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {creating ? (
          <Button variant="outline" className="h-10">
            <Plus aria-hidden /> Add record
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-9" aria-label={`Correct ${record.employee.name}'s attendance on ${formatDate(record.workDate)}`}>
            <Pencil aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
          <DialogHeader>
            <DialogTitle>{creating ? 'Add attendance record' : `Correct ${record.employee.name}`}</DialogTitle>
            <DialogDescription>
              {creating ? 'For a day with no record, such as a forgotten check-in.' : formatDate(record.workDate)} Times are in Dhaka time. The change is
              kept in the audit log.
            </DialogDescription>
          </DialogHeader>

          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          {creating && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                control={control}
                name="employeeId"
                label="Employee"
                required
                options={(employees ?? []).map((e) => ({ value: e.id, label: e.name, hint: e.employeeCode }))}
              />
              <TextField label="Date" type="date" required max={dhakaToday()} registration={register('workDate')} error={errors.workDate} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Checked in" type="time" registration={register('firstIn')} error={errors.firstIn} />
            <TextField label="Checked out" type="time" registration={register('lastOut')} error={errors.lastOut} />
          </div>

          <SelectField
            control={control}
            name="status"
            label="Status"
            optionalLabel="Work it out from the times"
            options={AttendanceStatus.map((status) => ({ value: status, label: ATTENDANCE_STATUS_LABELS[status] }))}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="correction-note">
              Reason<span aria-hidden className="text-danger-text">*</span>
            </Label>
            <Textarea id="correction-note" rows={2} placeholder="Badge reader was down" aria-invalid={errors.note ? true : undefined} {...register('note')} />
            {errors.note?.message && <p className="text-sm text-danger-text">{errors.note.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              {creating ? 'Add record' : 'Save correction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
