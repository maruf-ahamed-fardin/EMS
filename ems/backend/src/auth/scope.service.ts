import { Injectable } from '@nestjs/common';
import type { PermissionKey, PermissionScope } from '@ems/contracts';
import type { Prisma } from '../generated/prisma/client';
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

  /** Records that belong to an in-scope employee: `{ employee: employeeWhere(...) }` for related tables. */
  relatedToEmployee(auth: AuthContext, key: PermissionKey): { employee: Prisma.EmployeeWhereInput } {
    return { employee: this.employeeWhere(auth, key) };
  }
}
