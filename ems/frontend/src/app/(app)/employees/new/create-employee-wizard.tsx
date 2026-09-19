'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateEmployeeData,
  type CreateEmployeeInput,
  createEmployeeInput,
  type DataResponse,
  type EmployeeDetail,
  type EmployeeFormOptions,
} from '@ems/contracts';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, type FieldPath, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import { SelectField } from '@/components/forms/select-field';
import { PersonAvatar } from '@/components/shared/person-avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes';
import { api } from '@/lib/api-client';
import { EMPLOYMENT_TYPE_LABELS, formatDate, formatPhone, GENDER_LABELS } from '@/lib/employees';
import { applyApiError } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import { ContactFields, EmploymentFields, PersonalFields } from '../employee-fields';

type Values = CreateEmployeeInput;

export const STEPS: Array<{ title: string; description: string; fields: FieldPath<Values>[] }> = [
  { title: 'Personal', description: 'Name and birth date', fields: ['firstName', 'lastName', 'dateOfBirth', 'gender'] },
  {
    title: 'Employment',
    description: 'Team, position, manager',
    fields: ['departmentId', 'positionId', 'managerId', 'joiningDate', 'employmentType', 'workLocation', 'employeeCode'],
  },
  { title: 'Contact', description: 'Email, phone, address', fields: ['email', 'phone', 'address', 'emergencyContact'] },
  { title: 'Account', description: 'Sign-in and role', fields: ['createAccount', 'roleKey'] },
  { title: 'Review', description: 'Check and save', fields: [] },
];

/** Which step a server error belongs to, so the wizard can jump back to it. */
export function stepForField(field: string): number {
  const root = field.split('.')[0];
  const index = STEPS.findIndex((step) => step.fields.some((name) => name === root || name.startsWith(`${root}.`)));
  return index === -1 ? STEPS.length - 1 : index;
}

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: undefined,
  employeeCode: '',
  departmentId: '',
  positionId: '',
  managerId: null,
  joiningDate: '',
  employmentType: undefined as unknown as Values['employmentType'],
  workLocation: 'Dhaka office',
  email: '',
  phone: '',
  address: { line1: '', line2: '', city: 'Dhaka', postcode: '', country: 'Bangladesh' },
  emergencyContact: { name: '', relationship: '', phone: '' },
  createAccount: true,
  roleKey: 'employee',
};

export function CreateEmployeeWizard({ options }: { options: EmployeeFormOptions }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values, unknown, CreateEmployeeData>({
    resolver: zodResolver(createEmployeeInput),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });
  const { handleSubmit, trigger, setError, formState } = form;
  useUnsavedChangesWarning(formState.isDirty && !formState.isSubmitSuccessful);

  const last = STEPS.length - 1;

  async function next() {
    const ok = await trigger(STEPS[step]!.fields, { shouldFocus: true });
    if (ok) {
      setStep((s) => Math.min(s + 1, last));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { data } = await api<DataResponse<EmployeeDetail>>('/employees', { method: 'POST', body: values });
      toast.success(
        values.createAccount ? `${data.fullName} added. A set-password link was emailed to ${data.email}.` : `${data.fullName} added.`,
      );
      router.push(`/employees/${data.id}`);
      router.refresh();
    } catch (error) {
      const message = applyApiError(error, setError, [...STEPS.flatMap((s) => s.fields), 'address.line1', 'address.city', 'address.country', 'emergencyContact.name', 'emergencyContact.phone', 'emergencyContact.relationship']);
      setFormError(message);
      // Take the user to the first step with a problem
      const fields = Object.keys((error as { errors?: Record<string, string> }).errors ?? {});
      if (fields.length > 0) setStep(Math.min(...fields.map(stepForField)));
    }
  });

  return (
    <FormProvider {...form}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (step === last) void submit(event);
            else void next();
          }}
          noValidate
          className="min-w-0"
        >
          <Stepper step={step} onJump={(target) => target < step && setStep(target)} />

          <section className="mt-4 rounded-2xl border bg-card p-5 shadow-panel md:p-7" aria-labelledby="step-title">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 id="step-title" className="mt-1 text-lg font-semibold">
              {STEPS[step]!.title}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">{STEPS[step]!.description}</p>

            {formError && (
              <div className="mb-5">
                <FormAlert tone="error">{formError}</FormAlert>
              </div>
            )}

            {step === 0 && <PersonalFields />}
            {step === 1 && <EmploymentFields options={options} />}
            {step === 2 && <ContactFields />}
            {step === 3 && <AccountStep options={options} />}
            {step === 4 && <Review options={options} onEdit={setStep} />}
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center justify-between gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur-md md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
            {step === 0 ? (
              <Button asChild variant="ghost" className="h-11">
                <Link href="/employees">Cancel</Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-11" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft aria-hidden /> Back
              </Button>
            )}
            <Button type="submit" className="h-11 min-w-36" disabled={formState.isSubmitting}>
              {step === last ? (
                formState.isSubmitting ? (
                  <>
                    <LoaderCircle className="animate-spin" aria-hidden /> Saving…
                  </>
                ) : (
                  <>
                    <Check aria-hidden /> Add employee
                  </>
                )
              ) : (
                <>
                  Continue <ArrowRight aria-hidden />
                </>
              )}
            </Button>
          </div>
        </form>

        <LivePreview options={options} />
      </div>
    </FormProvider>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  return (
    <ol className="flex gap-1 overflow-x-auto rounded-2xl border bg-card p-2 shadow-panel">
      {STEPS.map((item, index) => {
        const done = index < step;
        const current = index === step;
        return (
          <li key={item.title} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onJump(index)}
              disabled={!done}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-3',
                current && 'bg-accent',
                done && 'hover:bg-secondary',
              )}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                  done ? 'bg-primary text-primary-foreground' : current ? 'border-2 border-primary text-accent-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" aria-label="Done" /> : index + 1}
              </span>
              <span className={cn('hidden min-w-0 sm:block', !current && 'max-xl:hidden')}>
                <span className="block truncate text-sm font-semibold">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function AccountStep({ options }: { options: EmployeeFormOptions }) {
  const { control } = useFormContext();
  const createAccount = useWatch({ control, name: 'createAccount' }) as boolean;
  return (
    <div className="grid grid-cols-1 gap-5">
      <Controller
        control={control}
        name="createAccount"
        render={({ field }) => (
          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <Label htmlFor="create-account" className="text-sm font-semibold">
                Give them a sign-in account
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                They get an email with a link to choose their own password. Nobody else ever sees it.
              </p>
            </div>
            <Switch id="create-account" checked={Boolean(field.value)} onCheckedChange={field.onChange} />
          </div>
        )}
      />
      {createAccount && (
        <SelectField
          control={control}
          name="roleKey"
          label="Role"
          required
          hint={options.roles.length === 1 ? 'Only a Super Admin can give new accounts other roles.' : undefined}
          options={options.roles.map((role) => ({ value: role.key, label: role.name }))}
        />
      )}
    </div>
  );
}

function Review({ options, onEdit }: { options: EmployeeFormOptions; onEdit: (step: number) => void }) {
  const values = useWatch() as Values;
  const department = options.departments.find((d) => d.id === values.departmentId);
  const position = options.positions.find((p) => p.id === values.positionId);
  const manager = options.managers.find((m) => m.id === values.managerId);
  const role = options.roles.find((r) => r.key === values.roleKey);

  const sections: Array<{ step: number; title: string; rows: Array<[string, string | undefined]> }> = [
    {
      step: 0,
      title: 'Personal',
      rows: [
        ['Name', `${values.firstName} ${values.lastName}`],
        ['Date of birth', values.dateOfBirth ? formatDate(values.dateOfBirth) : undefined],
        ['Gender', values.gender ? GENDER_LABELS[values.gender] : 'Not recorded'],
      ],
    },
    {
      step: 1,
      title: 'Employment',
      rows: [
        ['Employee ID', values.employeeCode || `${options.nextEmployeeCode} (next free)`],
        ['Department', department?.name],
        ['Position', position?.title],
        ['Manager', manager?.name ?? 'No manager'],
        ['Joining date', values.joiningDate ? formatDate(values.joiningDate) : undefined],
        ['Employment type', values.employmentType ? EMPLOYMENT_TYPE_LABELS[values.employmentType] : undefined],
        ['Work location', values.workLocation],
      ],
    },
    {
      step: 2,
      title: 'Contact',
      rows: [
        ['Work email', values.email],
        ['Phone', values.phone ? formatPhone(values.phone.replace(/[\s()-]/g, '')) : undefined],
        ['Address', [values.address.line1, values.address.line2, values.address.city, values.address.postcode, values.address.country].filter(Boolean).join(', ')],
        ['Emergency contact', `${values.emergencyContact.name} (${values.emergencyContact.relationship}) · ${values.emergencyContact.phone}`],
      ],
    },
    {
      step: 3,
      title: 'Account',
      rows: [['Sign-in', values.createAccount ? `Yes, as ${role?.name ?? values.roleKey}` : 'No account']],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      {sections.map((section) => (
        <div key={section.title} className="rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <Button type="button" variant="link" className="h-auto p-0" onClick={() => onEdit(section.step)}>
              Edit <span className="sr-only">{section.title.toLowerCase()}</span>
            </Button>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-[160px_1fr]">
            {section.rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium break-words">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {values.createAccount && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="size-4" aria-hidden /> The set-password link is emailed when you save, and lasts 3 days.
        </p>
      )}
    </div>
  );
}

function LivePreview({ options }: { options: EmployeeFormOptions }) {
  const values = useWatch() as Values;
  const name = `${values.firstName ?? ''} ${values.lastName ?? ''}`.trim();
  const department = options.departments.find((d) => d.id === values.departmentId);
  const position = options.positions.find((p) => p.id === values.positionId);
  const manager = options.managers.find((m) => m.id === values.managerId);

  return (
    <aside className="hidden lg:block" aria-label="Preview">
      <div className="sticky top-20 rounded-2xl border bg-card p-5 shadow-panel">
        <p className="text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">Live preview</p>
        <div className="mt-4 flex items-center gap-3">
          <PersonAvatar name={name || '?'} />
          <div className="min-w-0">
            <p className="truncate font-semibold">{name || 'New employee'}</p>
            <p className="truncate text-sm text-muted-foreground">{position?.title ?? 'Position not set'}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          {[
            ['ID', values.employeeCode || options.nextEmployeeCode],
            ['Team', department?.name ?? '—'],
            ['Manager', manager?.name ?? '—'],
            ['Starts', values.joiningDate ? formatDate(values.joiningDate) : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
