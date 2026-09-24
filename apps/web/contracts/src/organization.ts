import { z } from 'zod';

// ─── Departments ────────────────────────────────────────────────────────────────────────────────

export const DEPARTMENT_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;

const departmentFields = {
  name: z.string().trim().min(1, 'Enter a department name').max(100, 'Keep the name under 100 characters'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(DEPARTMENT_CODE_PATTERN, 'Use 2–10 letters or digits, starting with a letter, e.g. DEV'),
  description: z
    .string()
    .trim()
    .max(500, 'Keep the description under 500 characters')
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  headEmployeeId: z.uuid('Choose a department head').nullable().optional(),
  isActive: z.boolean().optional(),
};

export const createDepartmentInput = z.object(departmentFields);
export type CreateDepartmentInput = z.input<typeof createDepartmentInput>;

export const updateDepartmentInput = z.object(departmentFields).partial().strict();
export type UpdateDepartmentInput = z.input<typeof updateDepartmentInput>;

export const departmentListQuery = z.object({
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type DepartmentListQuery = z.infer<typeof departmentListQuery>;

export interface DepartmentListItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
  head: { id: string; name: string; positionTitle: string } | null;
  activeEmployeeCount: number;
  positionCount: number;
}

export interface PositionSummary {
  id: string;
  title: string;
  level: string | null;
  isActive: boolean;
  activeEmployeeCount: number;
}

export interface DepartmentDetail extends DepartmentListItem {
  inactiveEmployeeCount: number;
  positions: PositionSummary[];
  createdAt: string;
  updatedAt: string;
  allowedActions: { update: boolean; delete: boolean; managePositions: boolean };
}

// ─── Positions ──────────────────────────────────────────────────────────────────────────────────

const positionFields = {
  title: z.string().trim().min(1, 'Enter a position title').max(100, 'Keep the title under 100 characters'),
  /** Null for a position used across departments. */
  departmentId: z.uuid('Choose a department').nullable(),
  level: z
    .string()
    .trim()
    .max(50, 'Keep the level under 50 characters')
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
  isActive: z.boolean().optional(),
};

export const createPositionInput = z.object(positionFields);
export type CreatePositionInput = z.input<typeof createPositionInput>;

export const updatePositionInput = z.object(positionFields).partial().strict();
export type UpdatePositionInput = z.input<typeof updatePositionInput>;

export const positionListQuery = z.object({
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  departmentId: z
    .union([z.uuid(), z.literal('')])
    .optional()
    .transform((value) => value || undefined),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type PositionListQuery = z.infer<typeof positionListQuery>;

export interface PositionListItem extends PositionSummary {
  department: { id: string; name: string } | null;
}

/** People who can be made a department head: active employees. */
export interface DepartmentHeadOption {
  id: string;
  name: string;
  employeeCode: string;
  positionTitle: string;
  departmentId: string;
}
