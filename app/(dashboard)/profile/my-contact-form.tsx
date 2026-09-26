'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { addressInput, emergencyContactInput, type EmployeePrivateDetails, phoneNumber } from '@/lib/validations';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';

const schema = z.object({ phone: phoneNumber, address: addressInput, emergencyContact: emergencyContactInput });
type Input = z.input<typeof schema>;
type Output = z.output<typeof schema>;

export function MyContactForm({ phone, details }: { phone: string; details: EmployeePrivateDetails }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<Input, unknown, Output>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { phone, address: { ...details.address, line2: details.address.line2 ?? '', postcode: details.address.postcode ?? '' }, emergencyContact: details.emergencyContact },
  });
  useUnsavedChangesWarning(isDirty);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const body = Object.fromEntries(Object.keys(dirtyFields).map((key) => [key, values[key as keyof Output]]));
    try {
      await api('/me/profile', { method: 'PATCH', body });
      reset(values);
      toast.success('Your contact details were saved');
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['phone', 'address.line1', 'address.city', 'address.country', 'emergencyContact.name', 'emergencyContact.relationship', 'emergencyContact.phone']));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-6 rounded-2xl border bg-card p-5 shadow-panel md:p-7">
      <div>
        <h2 className="text-lg font-semibold">Contact details</h2>
        <p className="text-sm text-muted-foreground">Only you and HR can see these.</p>
      </div>
      {formError && <FormAlert tone="error">{formError}</FormAlert>}

      <TextField label="Phone" type="tel" required registration={register('phone')} error={errors.phone} className="sm:max-w-xs" />

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Address</legend>
        <TextField className="sm:col-span-2" label="Street address" required registration={register('address.line1')} error={errors.address?.line1} />
        <TextField className="sm:col-span-2" label="Apartment, floor (optional)" registration={register('address.line2')} error={errors.address?.line2} />
        <TextField label="City" required registration={register('address.city')} error={errors.address?.city} />
        <TextField label="Postcode" registration={register('address.postcode')} error={errors.address?.postcode} />
        <TextField label="Country" required registration={register('address.country')} error={errors.address?.country} />
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">Emergency contact</legend>
        <TextField label="Name" required registration={register('emergencyContact.name')} error={errors.emergencyContact?.name} />
        <TextField label="Relationship" required registration={register('emergencyContact.relationship')} error={errors.emergencyContact?.relationship} />
        <TextField label="Phone" type="tel" required registration={register('emergencyContact.phone')} error={errors.emergencyContact?.phone} />
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" className="h-11 min-w-32" disabled={isSubmitting || !isDirty}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
