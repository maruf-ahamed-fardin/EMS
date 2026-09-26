'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateDepartmentInput,
  createDepartmentInput,
  type DataResponse,
  type DepartmentDetail,
  type DepartmentHeadOption,
} from '@/lib/validations';
import { LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';

type Values = CreateDepartmentInput;

/** Create a department, or edit one when `department` is given. */
export function DepartmentFormDialog({ department }: { department?: DepartmentDetail }) {
  const router = useRouter();
  const editing = Boolean(department);
  const [open, setOpen] = useState(false);
  const [heads, setHeads] = useState<DepartmentHeadOption[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const defaults: Values = {
    name: department?.name ?? '',
    code: department?.code ?? '',
    description: department?.description ?? '',
    headEmployeeId: department?.head?.id ?? null,
    isActive: department?.isActive ?? true,
  };
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Values>({ resolver: zodResolver(createDepartmentInput), defaultValues: defaults });

  // Head options load when the dialog first opens, not with every page
  useEffect(() => {
    if (!open || heads) return;
    api<DataResponse<DepartmentHeadOption[]>>('/departments/head-options')
      .then(({ data }) => setHeads(data))
      .catch(() => setHeads([]));
  }, [open, heads]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (department) {
        const body = Object.fromEntries(Object.keys(dirtyFields).map((key) => [key, values[key as keyof Values]]));
        await api(`/departments/${department.id}`, { method: 'PATCH', body });
        toast.success(`Saved ${values.name}`);
        setOpen(false);
        router.refresh();
      } else {
        const { data } = await api<DataResponse<DepartmentDetail>>('/departments', { method: 'POST', body: values });
        toast.success(`${data.name} created`);
        setOpen(false);
        router.push(`/departments/${data.id}`);
        router.refresh();
      }
    } catch (error) {
      setFormError(applyApiError(error, setError, ['name', 'code', 'description', 'headEmployeeId', 'isActive']));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isSubmitting) return;
        // Filled from the item as it is now (empty when adding), never from the last form submitted
        if (next) reset(defaults);
        else setFormError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" className="h-10">
            <Pencil aria-hidden /> Edit
          </Button>
        ) : (
          <Button className="h-10">
            <Plus aria-hidden /> Add department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${department?.name}` : 'Add department'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Changes apply everywhere the department appears.' : 'Positions can be added once the department exists.'}
            </DialogDescription>
          </DialogHeader>

          {formError && <FormAlert tone="error">{formError}</FormAlert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <TextField label="Name" required autoFocus registration={register('name')} error={errors.name} />
            <TextField label="Code" required placeholder="DEV" autoCapitalize="characters" registration={register('code')} error={errors.code} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="department-description">Description</Label>
            <Textarea id="department-description" rows={3} placeholder="What this team is responsible for" {...register('description')} />
            {errors.description?.message && <p className="text-sm text-danger-text">{errors.description.message}</p>}
          </div>

          <SelectField
            control={control}
            name="headEmployeeId"
            label="Head of department"
            optionalLabel="No head yet"
            disabled={!heads}
            placeholder={heads ? 'Choose a person' : 'Loading people…'}
            options={(heads ?? []).map((h) => ({ value: h.id, label: h.name, hint: h.positionTitle }))}
          />

          {editing && (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <Label htmlFor="department-active" className="font-semibold">
                      Active
                    </Label>
                    <p className="text-xs text-muted-foreground">Inactive departments can&rsquo;t receive new employees.</p>
                  </div>
                  <Switch id="department-active" checked={field.value ?? true} onCheckedChange={field.onChange} />
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
              {editing ? 'Save' : 'Create department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
