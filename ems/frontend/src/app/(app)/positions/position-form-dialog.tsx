'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CreatePositionInput, createPositionInput, type PositionListItem } from '@ems/contracts';
import { LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';

type Values = CreatePositionInput;

export function PositionFormDialog({
  departments,
  position,
  defaultDepartmentId,
}: {
  departments: Array<{ id: string; name: string }>;
  position?: PositionListItem;
  /** Pre-selects the department when adding from a department page. */
  defaultDepartmentId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(position);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaults: Values = {
    title: position?.title ?? '',
    departmentId: position ? (position.department?.id ?? null) : (defaultDepartmentId ?? null),
    level: position?.level ?? '',
    isActive: position?.isActive ?? true,
  };
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Values>({ resolver: zodResolver(createPositionInput), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (position) {
        const body = Object.fromEntries(Object.keys(dirtyFields).map((key) => [key, values[key as keyof Values]]));
        await api(`/positions/${position.id}`, { method: 'PATCH', body });
        toast.success(`Saved ${values.title}`);
      } else {
        await api('/positions', { method: 'POST', body: values });
        toast.success(`${values.title} added`);
      }
      setOpen(false);
      reset(values);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['title', 'departmentId', 'level', 'isActive']));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        setOpen(next);
        if (!next) {
          reset(defaults);
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon" className="size-9" aria-label={`Edit ${position?.title}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button className="h-10">
            <Plus aria-hidden /> Add position
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${position?.title}` : 'Add position'}</DialogTitle>
            <DialogDescription>A position belongs to one department, or is shared across all of them.</DialogDescription>
          </DialogHeader>

          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          <TextField label="Title" required autoFocus registration={register('title')} error={errors.title} />
          <SelectField
            control={control}
            name="departmentId"
            label="Department"
            optionalLabel="Shared (any department)"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
          <TextField label="Level" placeholder="L3, Senior…" registration={register('level')} error={errors.level} />

          {editing && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <Label htmlFor="position-active" className="font-semibold">
                      Active
                    </Label>
                    <p className="text-xs text-muted-foreground">Inactive positions can&rsquo;t be given to new employees.</p>
                  </div>
                  <Switch id="position-active" checked={field.value ?? true} onCheckedChange={field.onChange} />
                </div>
              )}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              {editing ? 'Save' : 'Add position'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
