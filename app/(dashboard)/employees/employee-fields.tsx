'use client';

import { type CreateEmployeeInput, EmploymentType, type EmployeeFormOptions, Gender } from '@/lib/validations';
import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api } from '@/lib/client/api-client';
import { EMPLOYMENT_TYPE_HINTS, EMPLOYMENT_TYPE_LABELS, GENDER_LABELS } from '@/lib/client/employees';
import { cn } from '@/lib/client/utils';

/**
 * The field groups shared by the create wizard and the edit page. They read the surrounding
 * react-hook-form context, so both forms validate with the same contract schema.
 */
type Values = CreateEmployeeInput;

// Module-level, so the availability check effect sees a stable value
const CODE_SHAPE = /^[A-Za-z]{2,5}-\d{3,6}$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PersonalFields() {
  const { register, control, formState } = useFormContext<Values>();
  const errors = formState.errors;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField label="First name" required autoComplete="off" registration={register('firstName')} error={errors.firstName} />
      <TextField label="Last name" required autoComplete="off" registration={register('lastName')} error={errors.lastName} />
      <TextField label="Date of birth" type="date" required registration={register('dateOfBirth')} error={errors.dateOfBirth} />
      <SelectField
        control={control}
        name="gender"
        label="Gender"
        optionalLabel="Not recorded"
        options={Gender.map((gender) => ({ value: gender, label: GENDER_LABELS[gender] }))}
      />
    </div>
  );
}

export function EmploymentFields({ options, excludeEmployeeId }: { options: EmployeeFormOptions; excludeEmployeeId?: string }) {
  const { register, control, formState, setValue, getValues } = useFormContext<Values>();
  const errors = formState.errors;
  const departmentId = useWatch({ control, name: 'departmentId' });
  const employeeCode = useWatch({ control, name: 'employeeCode' });

  const positions = useMemo(
    () => options.positions.filter((p) => !p.departmentId || p.departmentId === departmentId),
    [options.positions, departmentId],
  );
  const department = options.departments.find((d) => d.id === departmentId);

  // A position from the previous department no longer fits
  useEffect(() => {
    const positionId = getValues('positionId');
    if (positionId && !positions.some((p) => p.id === positionId)) setValue('positionId', '', { shouldDirty: true });
  }, [departmentId, positions, getValues, setValue]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SelectField
        control={control}
        name="departmentId"
        label="Department"
        required
        options={options.departments.map((d) => ({ value: d.id, label: d.name }))}
      />
      <SelectField
        control={control}
        name="positionId"
        label="Position"
        required
        disabled={!departmentId}
        placeholder={departmentId ? 'Choose a position' : 'Choose a department first'}
        hint={department ? `Positions in ${department.name}` : undefined}
        options={positions.map((p) => ({ value: p.id, label: p.title }))}
      />
      <SelectField
        control={control}
        name="managerId"
        label="Manager"
        optionalLabel="No manager"
        hint="Leave requests go to this person"
        options={options.managers
          .filter((m) => m.id !== excludeEmployeeId)
          .map((m) => ({ value: m.id, label: m.name, hint: m.positionTitle }))}
      />
      <TextField label="Joining date" type="date" required registration={register('joiningDate')} error={errors.joiningDate} />

      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-sm font-medium">
          Employment type<span aria-hidden className="text-danger-text">*</span>
        </legend>
        <Controller
          control={control}
          name="employmentType"
          render={({ field, fieldState }) => (
            <>
              <RadioGroup
                value={field.value ?? ''}
                onValueChange={field.onChange}
                className="grid grid-cols-2 gap-2 lg:grid-cols-4"
                aria-invalid={fieldState.error ? true : undefined}
              >
                {EmploymentType.map((type) => (
                  <Label
                    key={type}
                    className={cn(
                      'flex min-h-14 cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal hover:bg-secondary',
                      field.value === type && 'border-primary/50 bg-accent/60',
                    )}
                  >
                    <RadioGroupItem value={type} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-semibold">{EMPLOYMENT_TYPE_LABELS[type]}</span>
                      <span className="block text-xs text-muted-foreground">{EMPLOYMENT_TYPE_HINTS[type]}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              {fieldState.error?.message && <p className="mt-2 text-sm text-danger-text">{fieldState.error.message}</p>}
            </>
          )}
        />
      </fieldset>

      <TextField label="Work location" required placeholder="Dhaka office" registration={register('workLocation')} error={errors.workLocation} />
      <div>
        <TextField
          label="Employee ID"
          placeholder={options.nextEmployeeCode}
          hint={excludeEmployeeId ? undefined : `Leave empty to use ${options.nextEmployeeCode}`}
          autoCapitalize="characters"
          registration={register('employeeCode')}
          error={errors.employeeCode}
        />
        <Availability field="employeeCode" value={employeeCode ?? ''} excludeId={excludeEmployeeId} valid={CODE_SHAPE} />
      </div>
    </div>
  );
}

/** `emailLocked`: the work email is their sign-in email, and the viewer doesn't manage accounts. */
export function ContactFields({ excludeEmployeeId, emailLocked = false }: { excludeEmployeeId?: string; emailLocked?: boolean }) {
  const { register, control, formState } = useFormContext<Values>();
  const errors = formState.errors;
  const email = useWatch({ control, name: 'email' });

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <TextField
            label="Work email"
            type="email"
            required
            autoComplete="off"
            readOnly={emailLocked}
            hint={emailLocked ? 'Also their sign-in email. Someone who manages user accounts can change it.' : undefined}
            registration={register('email')}
            error={errors.email}
          />
          {!emailLocked && <Availability field="email" value={email ?? ''} excludeId={excludeEmployeeId} valid={EMAIL_SHAPE} />}
        </div>
        <TextField label="Phone" type="tel" required placeholder="+880 1711-204318" registration={register('phone')} error={errors.phone} />
      </div>

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
        <TextField label="Relationship" required placeholder="Sister" registration={register('emergencyContact.relationship')} error={errors.emergencyContact?.relationship} />
        <TextField label="Phone" type="tel" required registration={register('emergencyContact.phone')} error={errors.emergencyContact?.phone} />
      </fieldset>
    </div>
  );
}

/** "Available" or "Already used by SX-014" under a field, checked shortly after typing stops. */
function Availability({
  field,
  value,
  excludeId,
  valid,
}: {
  field: 'email' | 'employeeCode';
  value: string;
  excludeId?: string;
  valid: RegExp;
}) {
  // The latest answer, remembered with the value it was for; a newer value simply has no answer yet
  const [result, setResult] = useState<{ value: string; status: 'available' | 'taken' | 'unknown'; takenBy?: string } | null>(null);
  const trimmed = value.trim();
  const checkable = valid.test(trimmed);

  useEffect(() => {
    if (!checkable) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ [field]: trimmed, ...(excludeId ? { excludeId } : {}) });
      api<{ data: { email?: { available: boolean; takenBy?: string }; employeeCode?: { available: boolean } } }>(
        `/employees/check-unique?${params.toString()}`,
      )
        .then(({ data }) => {
          if (cancelled) return;
          const answer = data[field];
          if (!answer) return setResult({ value: trimmed, status: 'unknown' });
          setResult(
            answer.available
              ? { value: trimmed, status: 'available' }
              : { value: trimmed, status: 'taken', takenBy: 'takenBy' in answer ? answer.takenBy : undefined },
          );
        })
        .catch(() => !cancelled && setResult({ value: trimmed, status: 'unknown' }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [field, trimmed, excludeId, checkable]);

  const state = !checkable
    ? { status: 'idle' as const }
    : result?.value === trimmed
      ? result.status === 'unknown'
        ? { status: 'idle' as const }
        : result
      : { status: 'checking' as const, takenBy: undefined };

  if (state.status === 'idle') return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs" aria-live="polite">
      {state.status === 'checking' && (
        <>
          <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Checking…</span>
        </>
      )}
      {state.status === 'available' && (
        <>
          <CircleCheck className="size-3.5 text-success-text" aria-hidden />
          <span className="text-success-text">Available</span>
        </>
      )}
      {state.status === 'taken' && (
        <>
          <CircleX className="size-3.5 text-danger-text" aria-hidden />
          <span className="text-danger-text">{state.takenBy ? `Already used by ${state.takenBy}` : 'Already taken'}</span>
        </>
      )}
    </p>
  );
}
