'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { createDocumentTypeInput, type DocumentTypeItem } from '@ems/contracts';
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

type Input = z.input<typeof createDocumentTypeInput>;
type Output = z.output<typeof createDocumentTypeInput>;

const SWITCHES: Array<{ name: 'isSensitive' | 'hasExpiry'; label: string; hint: string }> = [
  { name: 'isSensitive', label: 'Private', hint: 'Only people who may see private details (HR and the employee) can open these. Managers can’t.' },
  { name: 'hasExpiry', label: 'Expires', hint: 'Uploads need an expiry date, and HR and the employee are reminded 30, 7 and 0 days before.' },
];

export function DocumentTypeDialog({ type }: { type?: DocumentTypeItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: Input = type
    ? { name: type.name, code: type.code, isSensitive: type.isSensitive, hasExpiry: type.hasExpiry }
    : { name: '', code: '', isSensitive: false, hasExpiry: false };

  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Input, unknown, Output>({ resolver: zodResolver(createDocumentTypeInput), defaultValues: defaults });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (type) {
        const body = Object.fromEntries(Object.keys(dirtyFields).map((k) => [k, values[k as keyof Output]]));
        await api(`/document-types/${type.id}`, { method: 'PATCH', body });
        toast.success(`Saved ${values.name}`);
      } else {
        await api('/document-types', { method: 'POST', body: values });
        toast.success(`${values.name} added`);
      }
      setOpen(false);
      reset(values);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['name', 'code', 'isSensitive', 'hasExpiry']));
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
            <Plus aria-hidden /> Add document type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4">
          <DialogHeader>
            <DialogTitle>{type ? `Edit ${type.name}` : 'Add document type'}</DialogTitle>
            <DialogDescription>{type ? 'Making a type private hides its existing documents from managers straight away.' : 'What people can upload, such as a passport or a contract.'}</DialogDescription>
          </DialogHeader>
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <TextField label="Name" required registration={register('name')} error={errors.name} />
            <TextField label="Code" required autoCapitalize="characters" registration={register('code')} error={errors.code} />
          </div>
          {SWITCHES.map((s) => (
            <Controller
              key={s.name}
              control={control}
              name={s.name}
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
                  <div>
                    <Label htmlFor={`document-type-${s.name}`} className="font-semibold">
                      {s.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{s.hint}</p>
                  </div>
                  <Switch id={`document-type-${s.name}`} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
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
              {type ? 'Save' : 'Add document type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
