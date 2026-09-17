'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createLeaveTypeInput, type LeaveTypeItem } from '@ems/contracts';
import { LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';

type Input = z.input<typeof createLeaveTypeInput>;
type Output = z.output<typeof createLeaveTypeInput>;

const SWITCHES: Array<{ name: 'isPaid' | 'isActive'; label: string; hint: string }> = [
  { name: 'isPaid', label: 'Paid', hint: 'Unpaid leave has no yearly balance.' },
  { name: 'isActive', label: 'Active', hint: 'Inactive types can’t be requested.' },
];

export function LeaveTypeDialog({ type }: { type?: LeaveTypeItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: Input = type
    ? { name: type.name, code: type.code, defaultDaysPerYear: type.defaultDaysPerYear, carryForwardMax: type.carryForwardMax, isPaid: type.isPaid, requiresDocument: type.requiresDocument, isActive: type.isActive }
    : { name: '', code: '', defaultDaysPerYear: 10, carryForwardMax: 0, isPaid: true, requiresDocument: false, isActive: true };

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Input, unknown, Output>({ resolver: zodResolver(createLeaveTypeInput), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (type) {
        const body = Object.fromEntries(Object.keys(dirtyFields).map((k) => [k, values[k as keyof Output]]));
        await api(`/leave/types/${type.id}`, { method: 'PATCH', body });
        toast.success(`Saved ${values.name}`);
      } else {
        await api('/leave/types', { method: 'POST', body: values });
        toast.success(`${values.name} added`);
      }
      setOpen(false);
      reset(values);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['name', 'code', 'defaultDaysPerYear', 'carryForwardMax', 'isPaid', 'isActive']));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && (setOpen(next), !next && (reset(defaults), setFormError(null)))}>
      <DialogTrigger asChild>
        {type ? (
          <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${type.name}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button className="h-10">
            <Plus aria-hidden /> Add leave type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{type ? `Edit ${type.name}` : 'Add leave type'}</DialogTitle>
            <DialogDescription>{type ? 'A new yearly allowance applies to balances created from now on.' : 'Paid types give every active employee this year’s balance, prorated for this year’s joiners.'}</DialogDescription>
          </DialogHeader>
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <TextField label="Name" required registration={register('name')} error={errors.name} />
            <TextField label="Code" required autoCapitalize="characters" registration={register('code')} error={errors.code} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Days per year" type="number" step="0.5" min={0} required registration={register('defaultDaysPerYear')} error={errors.defaultDaysPerYear} />
            <TextField label="Carry over up to" type="number" step="0.5" min={0} registration={register('carryForwardMax')} error={errors.carryForwardMax} />
          </div>
          {SWITCHES.map((s) => (
            <Controller
              key={s.name}
              control={control}
              name={s.name}
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <Label htmlFor={`leave-type-${s.name}`} className="font-semibold">
                      {s.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                  <Switch id={`leave-type-${s.name}`} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                </div>
              )}
            />
          ))}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              {type ? 'Save' : 'Add leave type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
