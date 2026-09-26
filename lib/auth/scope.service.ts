import { Injectable } from '@nestjs/common';
import type { PermissionKey, PermissionScope } from '@/lib/validations';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import type { AuthContext } from './auth-context';

/** Matches no row: used when a scope can't apply (OWN or TEAM for a user with no employee record). */
const NOTHING: Prisma.EmployeeWhereInput = { id: { in: [] } };

/**
 * Turns a granted scope into a Prisma filter (plan §4). Every list and detail query in a scoped module
 * goes through here, so an out-of-scope record is simply not found (404), never shown.
 */
@Injectable()
export class ScopeService {
  scopeOf(auth: AuthContext, key: PermissionKey): PermissionScope | null {
    return auth.permissions[key] ?? null;
  }

  /** Employees the user may act on with `key`. Soft-deleted employees are always excluded. */
  employeeWhere(auth: AuthContext, key: PermissionKey): Prisma.EmployeeWhereInput {
    const notDeleted: Prisma.EmployeeWhereInput = { deletedAt: null };
    const ownEmployee = auth.user.employeeId;

    switch (this.scopeOf(auth, key)) {
      case 'ALL':
        return notDeleted;
      case 'TEAM':
        // One level down: direct reports, plus the manager's own record
        return ownEmployee ? { ...notDeleted, OR: [{ id: ownEmployee }, { managerId: ownEmployee }] } : NOTHING;
      case 'OWN':
        return ownEmployee ? { ...notDeleted, id: ownEmployee } : NOTHING;
      default:
        return NOTHING;
    }
  }

  /**
   * One employee by id, only if it is within reach of `key`. Always use this for single-record lookups:
   * spreading `employeeWhere` next to an `id` lets the scope's own `id` (OWN scope) silently replace the
   * requested one, which answers with the caller's record instead of 404.
   */
  employeeById(auth: AuthContext, key: PermissionKey, id: string): Prisma.EmployeeWhereInput {
    return { AND: [{ id }, this.employeeWhere(auth, key)] };
  }

  /**
   * Whether one already-loaded employee is within reach of `key`. Use it for decisions about a record
   * the caller can see anyway, such as showing private fields or offering an action.
   */
  reaches(auth: AuthContext, key: PermissionKey, employee: { id: string; managerId: string | null }): boolean {
    const own = auth.user.employeeId;
    switch (this.scopeOf(auth, key)) {
      case 'ALL':
        return true;
      case 'TEAM':
        return own !== null && (employee.id === own || employee.managerId === own);
      case 'OWN':
        return own !== null && employee.id === own;
      default:
        return false;
    }
  }

  /** Records that belong to an in-scope employee: `{ employee: employeeWhere(...) }` for related tables. */
  relatedToEmployee(auth: AuthContext, key: PermissionKey): { employee: Prisma.EmployeeWhereInput } {
    return { employee: this.employeeWhere(auth, key) };
  }
}
