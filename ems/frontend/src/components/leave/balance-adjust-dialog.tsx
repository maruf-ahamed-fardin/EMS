'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { adjustLeaveBalanceInput, type LeaveBalanceRow } from '@ems/contracts';
import { LoaderCircle, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';
import { daysLabel } from '@/lib/leave';

type Input = z.input<typeof adjustLeaveBalanceInput>;
type Output = z.output<typeof adjustLeaveBalanceInput>;

/** HR changes a balance's allowance or carried-over days, with a reason that goes into the audit log. */
export function BalanceAdjustDialog({ balance }: { balance: LeaveBalanceRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: Input = { allocated: balance.allocated, carriedForward: balance.carriedForward, note: '' };

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, Output>({ resolver: zodResolver(adjustLeaveBalanceInput), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await api(`/leave/balances/${balance.id}`, { method: 'PATCH', body: values });
      toast.success(`${balance.leaveType.name} balance updated for ${balance.employee.name}`);
      setOpen(false);
      reset({ ...values, note: '' });
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['allocated', 'carriedForward', 'note']));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && (setOpen(next), !next && (reset(defaults), setFormError(null)))}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 size-9" aria-label={`Adjust ${balance.leaveType.name} balance`}>
          <SlidersHorizontal aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Adjust {balance.leaveType.name} balance</DialogTitle>
            <DialogDescription>
              {balance.employee.name} · {balance.year}. {daysLabel(balance.used + balance.pending)} already used or waiting, so the total can&rsquo;t go below that.
            </DialogDescription>
          </DialogHeader>
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Allowance" type="number" step="0.5" min={0} required registration={register('allocated')} error={errors.allocated} />
            <TextField label="Carried over" type="number" step="0.5" min={0} required registration={register('carriedForward')} error={errors.carriedForward} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`balance-note-${balance.id}`}>
              Reason<span aria-hidden className="text-danger-text">*</span>
            </Label>
            <Textarea
              id={`balance-note-${balance.id}`}
              rows={2}
              placeholder="Joined mid-month; agreed two extra days"
              aria-invalid={errors.note ? true : undefined}
              {...register('note')}
            />
            {errors.note?.message && <p className="text-sm text-danger-text">{errors.note.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              Save balance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
