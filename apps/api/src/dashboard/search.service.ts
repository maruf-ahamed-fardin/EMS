import { Injectable } from '@nestjs/common';
import { can, SEARCH_RESULT_LIMIT, type SearchResults } from '@ems/contracts';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ⌘K search (plan §6): up to five employees, departments and positions. Employees go through the same
 * scope as the employee list, so search can't reveal anyone the list wouldn't.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async search(auth: AuthContext, q: string): Promise<SearchResults> {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 5);
    const contains = (word: string) => ({ contains: word, mode: 'insensitive' as const });

    const [employees, departments, positions] = await Promise.all([
      can(auth.permissions, 'employee.view')
        ? this.prisma.employee.findMany({
            where: {
              AND: [
                this.scope.employeeWhere(auth, 'employee.view'),
                ...words.map((word) => ({
                  OR: [{ firstName: contains(word) }, { lastName: contains(word) }, { employeeCode: contains(word) }, { email: contains(word) }],
                })),
              ],
            },
            // Active people first, then by name
            orderBy: [{ status: 'asc' }, { firstName: 'asc' }, { lastName: 'asc' }],
            take: SEARCH_RESULT_LIMIT,
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              position: { select: { title: true } },
              department: { select: { name: true } },
            },
          })
        : [],
      can(auth.permissions, 'department.view')
        ? this.prisma.department.findMany({
            where: { deletedAt: null, OR: [{ name: contains(q) }, { code: contains(q) }] },
            orderBy: { name: 'asc' },
            take: SEARCH_RESULT_LIMIT,
            select: { id: true, name: true, code: true },
          })
        : [],
      can(auth.permissions, 'position.view')
        ? this.prisma.position.findMany({
            where: { deletedAt: null, title: contains(q) },
            orderBy: { title: 'asc' },
            take: SEARCH_RESULT_LIMIT,
            select: { id: true, title: true, departmentId: true, department: { select: { name: true } } },
          })
        : [],
    ]);

    return {
      employees: employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        employeeCode: e.employeeCode,
        positionTitle: e.position.title,
        departmentName: e.department.name,
      })),
      departments,
      positions: positions.map((p) => ({ id: p.id, title: p.title, departmentId: p.departmentId, departmentName: p.department?.name ?? null })),
    };
  }
}
