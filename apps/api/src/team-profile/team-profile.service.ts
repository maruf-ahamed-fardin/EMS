import { Injectable, NotFoundException } from '@nestjs/common';
import {
  can,
  type OwnTeamProfile,
  pageMeta,
  type TeamProfileDetail,
  type TeamProfileFilters,
  type TeamProfileListItem,
  type TeamProfileListResponse,
  type TeamProfileQuery,
  type UpdateOwnTeamProfileInput,
} from '@ems/contracts';
import type { AuthContext } from '../auth/auth-context';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** The most namesakes a lookup returns; past this the viewer has to use the employee ID. */
export const LOOKUP_NAMESAKES_MAX = 10;

/** Only people who are here and working appear on the directory. */
const LISTED = { deletedAt: null, status: 'ACTIVE' } as const;

/**
 * The only columns Team Profile ever reads (plan §12). Deliberately NOT the employee select:
 * that one carries date of birth, address and emergency contact, and a card must not be able to
 * return them even by mistake. A new column on `employees` does not appear here by default.
 */
export const CARD_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  bloodGroup: true,
  workLocation: true,
  joiningDate: true,
  photoKey: true,
  department: { select: { id: true, name: true } },
  position: { select: { title: true } },
  manager: { select: { firstName: true, lastName: true } },
  teamProfile: {
    select: {
      businessPhone: true,
      headline: true,
      showPersonalPhone: true,
      links: { select: { kind: true, url: true }, orderBy: { kind: 'asc' } },
    },
  },
} satisfies Prisma.EmployeeSelect;

/**
 * Every word of the search must match somewhere, so "anika akter" finds Anika Akter rather than
 * nobody (no single column contains both words) or everyone called Anika.
 */
export function searchWhere(q: string): Prisma.EmployeeWhereInput {
  const terms = q.split(/\s+/).filter(Boolean);
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { employeeCode: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    })),
  };
}

export type CardRow = Prisma.EmployeeGetPayload<{ select: typeof CARD_SELECT }>;
type Row = CardRow;

/** Two people have the same name when these match: case and extra spaces do not count. */
function fullNameKey(first: string, last: string): string {
  return `${first} ${last}`.trim().replace(/\s+/g, ' ').toLowerCase();
}

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function toListItem(row: Row): TeamProfileListItem {
  return {
    employeeId: row.id,
    employeeCode: row.employeeCode,
    fullName: `${row.firstName} ${row.lastName}`,
    initials: initialsOf(row.firstName, row.lastName),
    position: row.position.title,
    department: row.department.name,
    workLocation: row.workLocation,
    email: row.email,
    hasPhoto: row.photoKey !== null,
    // Tags arrive with the NFC phase; until then no card claims to have one.
    hasTag: false,
    businessPhone: row.teamProfile?.businessPhone ?? null,
    headline: row.teamProfile?.headline ?? null,
    links: row.teamProfile?.links ?? [],
    managerName: row.manager ? `${row.manager.firstName} ${row.manager.lastName}` : null,
    joiningDate: row.joiningDate.toISOString().slice(0, 10),
  };
}

export function toDetail(row: Row, viewerEmployeeId: string | null): TeamProfileDetail {
  const showsPersonal = row.teamProfile?.showPersonalPhone ?? true;
  return {
    ...toListItem(row),
    personalPhone: showsPersonal ? row.phone : null,
    bloodGroup: row.bloodGroup,
    isSelf: viewerEmployeeId !== null && viewerEmployeeId === row.id,
  };
}

@Injectable()
export class TeamProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The directory. `team_profile.browse` (HR, managers, admins by default) pages through everyone,
   * with filters. Without it the list is a lookup: see {@link lookup}. Either way the response
   * is the card shape, which carries no private field.
   */
  async list(auth: AuthContext, query: TeamProfileQuery): Promise<TeamProfileListResponse> {
    if (!can(auth.permissions, 'team_profile.browse')) return this.lookup(query);

    const where: Prisma.EmployeeWhereInput = {
      ...LISTED,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.workLocation ? { workLocation: query.workLocation } : {}),
      ...(query.q ? searchWhere(query.q) : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: CARD_SELECT,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { data: rows.map(toListItem), meta: pageMeta(query.page, query.limit, total), mode: 'browse', ambiguous: false };
  }

  /**
   * For people who may look a colleague up but not browse: nothing until they search, and then
   * only the person the search names — an exact employee ID or email, or a name. When several
   * people share that same full name, all of them are shown (up to {@link LOOKUP_NAMESAKES_MAX}),
   * each with their own employee ID. A search matching *different* names returns nobody, so a
   * one-letter query cannot list the company. Filters and paging are ignored.
   */
  private async lookup(query: TeamProfileQuery): Promise<TeamProfileListResponse> {
    const none = (ambiguous: boolean): TeamProfileListResponse => ({
      data: [],
      meta: pageMeta(1, query.limit, 0),
      mode: 'lookup',
      ambiguous,
    });
    const found = (rows: CardRow[]): TeamProfileListResponse => ({
      data: rows.map(toListItem),
      meta: pageMeta(1, Math.max(query.limit, rows.length), rows.length),
      mode: 'lookup',
      ambiguous: false,
    });

    if (!query.q) return none(false);

    const exact = await this.prisma.employee.findFirst({
      where: {
        ...LISTED,
        OR: [
          { employeeCode: { equals: query.q, mode: 'insensitive' } },
          { email: { equals: query.q, mode: 'insensitive' } },
        ],
      },
      select: CARD_SELECT,
    });
    if (exact) return found([exact]);

    // One more than the cap: enough to know whether the search names one name, never a list
    const rows = await this.prisma.employee.findMany({
      where: { ...LISTED, ...searchWhere(query.q) },
      orderBy: [{ employeeCode: 'asc' }],
      take: LOOKUP_NAMESAKES_MAX + 1,
      select: CARD_SELECT,
    });
    if (rows.length === 0) return none(false);
    const names = new Set(rows.map((row) => fullNameKey(row.firstName, row.lastName)));
    if (names.size === 1 && rows.length <= LOOKUP_NAMESAKES_MAX) return found(rows);
    return none(true);
  }

  async filters(): Promise<TeamProfileFilters> {
    const [departments, locations] = await Promise.all([
      this.prisma.department.findMany({
        where: { deletedAt: null, employees: { some: LISTED } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: LISTED,
        select: { workLocation: true },
        distinct: ['workLocation'],
        orderBy: { workLocation: 'asc' },
      }),
    ]);
    return { departments, workLocations: locations.map((row) => row.workLocation) };
  }

  async detail(auth: AuthContext, employeeId: string): Promise<TeamProfileDetail> {
    const row = await this.prisma.employee.findFirst({ where: { id: employeeId, ...LISTED }, select: CARD_SELECT });
    if (!row) throw new NotFoundException('This person is not in the team profile');
    return toDetail(row, auth.user.employeeId);
  }

  /** The signed-in person's own card, including what only they can see. */
  async own(auth: AuthContext): Promise<OwnTeamProfile> {
    const employeeId = auth.user.employeeId;
    if (!employeeId) throw new NotFoundException('This account is not linked to an employee record');

    const row = await this.prisma.employee.findFirst({ where: { id: employeeId, ...LISTED }, select: CARD_SELECT });
    if (!row) throw new NotFoundException('This account is not linked to an employee record');

    return {
      businessPhone: row.teamProfile?.businessPhone ?? null,
      bloodGroup: row.bloodGroup,
      headline: row.teamProfile?.headline ?? null,
      showPersonalPhone: row.teamProfile?.showPersonalPhone ?? true,
      personalPhone: row.phone,
      links: row.teamProfile?.links ?? [],
      hasPhoto: row.photoKey !== null,
    };
  }

  /**
   * Saves the viewer's own card. One transaction: the card row, its links and the audit entry
   * land together or not at all. Blood group lives on `employees`, the rest on `team_profiles`.
   */
  async updateOwn(auth: AuthContext, input: UpdateOwnTeamProfileInput): Promise<OwnTeamProfile> {
    const employeeId = auth.user.employeeId;
    if (!employeeId) throw new NotFoundException('This account is not linked to an employee record');

    const before = await this.own(auth);

    await this.prisma.$transaction(async (tx) => {
      if (input.bloodGroup !== undefined) {
        await tx.employee.update({ where: { id: employeeId }, data: { bloodGroup: input.bloodGroup } });
      }

      const card = {
        ...(input.businessPhone !== undefined ? { businessPhone: input.businessPhone } : {}),
        ...(input.headline !== undefined ? { headline: input.headline } : {}),
        ...(input.showPersonalPhone !== undefined ? { showPersonalPhone: input.showPersonalPhone } : {}),
      };
      await tx.teamProfile.upsert({ where: { employeeId }, create: { employeeId, ...card }, update: card });

      if (input.links !== undefined) {
        // Replace rather than merge: the form always sends the full set the person wants
        await tx.teamProfileLink.deleteMany({ where: { employeeId } });
        if (input.links.length > 0) {
          await tx.teamProfileLink.createMany({
            data: input.links.map((link) => ({ employeeId, kind: link.kind, url: link.url })),
          });
        }
      }

      await this.audit.record(
        {
          action: 'team_profile.updated',
          entityType: 'team_profile',
          entityId: employeeId,
          before: { ...before },
          after: { ...input },
        },
        tx,
      );
    });

    return this.own(auth);
  }

}
