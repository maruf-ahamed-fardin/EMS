'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateEmployeeData,
  type CreateEmployeeInput,
  createEmployeeInput,
  type DataResponse,
  type EmployeeDetail,
  type EmployeeFormOptions,
} from '@/lib/validations';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import { Button } from '@/components/ui/button';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';
import { ContactFields, EmploymentFields, PersonalFields } from '../../employee-fields';

type Values = CreateEmployeeInput;

const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'dateOfBirth', 'gender', 'employeeCode', 'departmentId', 'positionId', 'managerId',
  'joiningDate', 'employmentType', 'workLocation', 'email', 'phone', 'address', 'emergencyContact',
] as const;

/** Only the fields someone touched are sent, so two people editing different fields don't overwrite each other. */
export function dirtyValues<T extends Record<string, unknown>>(values: T, dirty: Partial<Record<keyof T, unknown>>): Partial<T> {
  return Object.fromEntries(Object.keys(dirty).filter((key) => key in values).map((key) => [key, values[key]])) as Partial<T>;
}

export function EditEmployeeForm({ employee, options }: { employee: EmployeeDetail; options: EmployeeFormOptions }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const details = employee.private!;
  const form = useForm<Values, unknown, CreateEmployeeData>({
    resolver: zodResolver(createEmployeeInput),
    mode: 'onTouched',
    defaultValues: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      dateOfBirth: details.dateOfBirth,
      gender: employee.gender ?? undefined,
      employeeCode: employee.employeeCode,
      departmentId: employee.department.id,
      positionId: employee.position.id,
      managerId: employee.manager?.id ?? null,
      joiningDate: employee.joiningDate,
      employmentType: employee.employmentType,
      workLocation: employee.workLocation,
      email: employee.email,
      phone: employee.phone,
      address: { ...details.address, line2: details.address.line2 ?? '', postcode: details.address.postcode ?? '' },
      emergencyContact: details.emergencyContact,
      createAccount: false,
      roleKey: 'employee',
    },
  });
  const { handleSubmit, setError, formState } = form;
  useUnsavedChangesWarning(formState.isDirty && !formState.isSubmitSuccessful);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const changes = dirtyValues(values as unknown as Record<string, unknown>, formState.dirtyFields as Record<string, unknown>);
    const body = Object.fromEntries(Object.entries(changes).filter(([key]) => (EDITABLE_FIELDS as readonly string[]).includes(key)));
    if (Object.keys(body).length === 0) {
      router.push(`/employees/${employee.id}`);
      return;
    }
    try {
      await api<DataResponse<EmployeeDetail>>(`/employees/${employee.id}`, { method: 'PATCH', body });
      toast.success(`Saved changes to ${values.firstName} ${values.lastName}`);
      router.push(`/employees/${employee.id}`);
      router.refresh();
    } catch (error) {
      setFormError(applyApiError(error, setError, [...EDITABLE_FIELDS, 'address.line1', 'address.city', 'address.country', 'emergencyContact.name', 'emergencyContact.phone']));
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 max-w-4xl gap-6">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <Section title="Personal">
          <PersonalFields />
        </Section>
        <Section title="Employment">
          <EmploymentFields options={options} excludeEmployeeId={employee.id} />
        </Section>
        <Section title="Contact">
          <ContactFields excludeEmployeeId={employee.id} emailLocked={!employee.allowedActions.changeEmail} />
        </Section>

        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <Button asChild variant="ghost" className="h-11">
            <Link href={`/employees/${employee.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" className="h-11 min-w-32" disabled={formState.isSubmitting || !formState.isDirty}>
            {formState.isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
            {formState.isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-panel md:p-7" aria-label={title}>
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
