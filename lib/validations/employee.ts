import { z } from 'zod';
import { MAX_PAGE_LIMIT } from '@/lib/validations/api';
import { EmployeeStatus, EmploymentType, Gender } from '@/lib/validations/enums';

// ─── Field rules shared by the API and the forms ────────────────────────────────────────────────

const requiredText = (label: string, max = 100) =>
  z.string().trim().min(1, `Enter ${label}`).max(max, `Keep ${label} under ${max} characters`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

/** YYYY-MM-DD, a real calendar date. Dates are calendar days, never times (docs/database.md). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Enter a real date');

export const phoneNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter a phone number, e.g. +8801711204318'));

export const EMPLOYEE_CODE_PATTERN = /^[A-Z]{2,5}-\d{3,6}$/;
export const employeeCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(EMPLOYEE_CODE_PATTERN, 'Use letters, a dash and digits, e.g. SX-061');

const workEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter a work email')
  .max(254, 'That email address is too long')
  .pipe(z.email('Enter a valid email address'));

const uuid = (label: string) => z.uuid(`Choose ${label}`);

export const addressInput = z.object({
  line1: requiredText('the street address', 200),
  line2: optionalText(200),
  city: requiredText('the city'),
  postcode: optionalText(20),
  country: requiredText('the country'),
});
export type Address = z.infer<typeof addressInput>;

export const emergencyContactInput = z.object({
  name: requiredText('their name'),
  relationship: requiredText('the relationship', 50),
  phone: phoneNumber,
});
export type EmergencyContact = z.infer<typeof emergencyContactInput>;

function ageOn(dateOfBirth: string, today = new Date()): number {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// ─── Create / update ────────────────────────────────────────────────────────────────────────────

/** Step 1 of the create form. */
export const employeePersonalInput = z.object({
  firstName: requiredText('a first name'),
  lastName: requiredText('a last name'),
  dateOfBirth: isoDate.refine((value) => {
    const age = ageOn(value);
    return age >= 16 && age <= 100;
  }, 'Employees must be between 16 and 100 years old'),
  gender: z.enum(Gender).optional(),
});

/** Step 2. */
export const employeeEmploymentInput = z.object({
  /** Leave empty to get the next free code. */
  employeeCode: employeeCode.optional().or(z.literal('').transform(() => undefined)),
  departmentId: uuid('a department'),
  positionId: uuid('a position'),
  managerId: z.uuid('Choose a manager').nullable().optional(),
  joiningDate: isoDate,
  employmentType: z.enum(EmploymentType, 'Choose an employment type'),
  workLocation: requiredText('a work location'),
});

/** Step 3. */
export const employeeContactInput = z.object({
  email: workEmail,
  phone: phoneNumber,
  address: addressInput,
  emergencyContact: emergencyContactInput,
});

/** Step 4: an optional sign-in account. The person sets their own password from an emailed link. */
export const employeeAccountInput = z.object({
  createAccount: z.boolean().default(false),
  /** A role key such as `employee`. Anything other than `employee` needs `user.manage`. */
  roleKey: z.string().min(1).max(50).default('employee'),
});

export const createEmployeeInput = employeePersonalInput
  .extend(employeeEmploymentInput.shape)
  .extend(employeeContactInput.shape)
  .extend(employeeAccountInput.shape);
export type CreateEmployeeInput = z.input<typeof createEmployeeInput>;
export type CreateEmployeeData = z.output<typeof createEmployeeInput>;

/** HR edits: any record field. Status changes have their own endpoints. */
export const updateEmployeeInput = employeePersonalInput
  .extend(employeeEmploymentInput.shape)
  .extend(employeeContactInput.shape)
  .extend({ employeeCode })
  .partial()
  .strict();
export type UpdateEmployeeInput = z.input<typeof updateEmployeeInput>;

/** What employees may change about themselves (assumption 8). Photo arrives with documents. */
export const updateMyProfileInput = z
  .object({ phone: phoneNumber, address: addressInput, emergencyContact: emergencyContactInput })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Change at least one field');
export type UpdateMyProfileInput = z.input<typeof updateMyProfileInput>;

// ─── List ───────────────────────────────────────────────────────────────────────────────────────

export const EMPLOYEE_SORTS = ['name', '-name', 'code', '-code', 'joined', '-joined', 'created', '-created'] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

const optionalUuid = z
  .union([z.uuid(), z.literal('')])
  .optional()
  .transform((value) => value || undefined);

export const employeeListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20),
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  departmentId: optionalUuid,
  positionId: optionalUuid,
  managerId: optionalUuid,
  status: z.enum(EmployeeStatus).optional().catch(undefined),
  employmentType: z.enum(EmploymentType).optional().catch(undefined),
  /** Joined on or after this date. */
  joinedFrom: isoDate.optional().catch(undefined),
  sort: z.enum(EMPLOYEE_SORTS).default('name').catch('name'),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuery>;

export const checkUniqueQuery = z.object({
  email: z.string().trim().toLowerCase().max(254).optional(),
  employeeCode: z.string().trim().toUpperCase().max(20).optional(),
  /** The employee being edited, whose own values don't count as taken. */
  excludeId: z.uuid().optional(),
});

// ─── Responses ──────────────────────────────────────────────────────────────────────────────────

export interface Ref {
  id: string;
  name: string;
}

export interface EmployeeListItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  department: Ref;
  position: { id: string; title: string };
  manager: Ref | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  joiningDate: string;
  workLocation: string;
}

export interface EmployeePrivateDetails {
  dateOfBirth: string;
  address: Address;
  emergencyContact: EmergencyContact;
}

export interface EmployeeDetail extends EmployeeListItem {
  phone: string;
  gender: Gender | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  directReportCount: number;
  /** Present only when the viewer holds `employee.view_private` for this person (assumption 11). */
  private: EmployeePrivateDetails | null;
  /** Present only when the viewer holds `user.view`. */
  account: { id: string; email: string; status: string; role: { key: string; name: string }; lastLoginAt: string | null } | null;
  /** What the viewer may do with this record, so the page doesn't have to recompute scope. */
  /** `changeEmail`: the work email is also the sign-in email, so changing it on an account needs `user.manage`. */
  allowedActions: { update: boolean; changeEmail: boolean; deactivate: boolean; reactivate: boolean; delete: boolean };
}

export interface EmployeeActivityItem {
  id: string;
  action: string;
  actor: string | null;
  /** Names of the fields that changed, never their values. */
  changedFields: string[];
  createdAt: string;
}

export interface EmployeeFormOptions {
  departments: Array<{ id: string; name: string; code: string }>;
  positions: Array<{ id: string; title: string; departmentId: string | null }>;
  managers: Array<{ id: string; name: string; employeeCode: string; positionTitle: string }>;
  /** Roles the caller may give a new account. */
  roles: Array<{ key: string; name: string }>;
  nextEmployeeCode: string;
}

export interface UniquenessResult {
  email?: { available: boolean; takenBy?: string };
  employeeCode?: { available: boolean };
}
