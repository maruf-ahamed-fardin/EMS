import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type OwnTeamProfile,
  pageMeta,
  type TeamProfileDetail,
  type TeamProfileFilters,
  type TeamProfileLink,
  type TeamProfileListItem,
  type TeamProfileQuery,
  type UpdateOwnTeamProfileInput,
} from '@ems/contracts';
import type { AuthContext } from '../auth/auth-context';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Only people who are here and working appear on the directory. */
const LISTED = { deletedAt: null, status: 'ACTIVE' } as const;

/**
 * The only columns Team Profile ever reads (plan §12). Deliberately NOT the employee select:
 * that one carries date of birth, address and emergency contact, and a card must not be able to
 * return them even by mistake. A new column on `employees` does not appear here by default.
 */
const CARD_SELECT = {
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

type Row = Prisma.EmployeeGetPayload<{ select: typeof CARD_SELECT }>;

function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function toListItem(row: Row): TeamProfileListItem {
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
  };
}

function toDetail(row: Row, viewerEmployeeId: string | null): TeamProfileDetail {
  const profile = row.teamProfile;
  const showsPersonal = profile?.showPersonalPhone ?? true;
  return {
    ...toListItem(row),
    personalPhone: showsPersonal ? row.phone : null,
    businessPhone: profile?.businessPhone ?? null,
    bloodGroup: row.bloodGroup,
    headline: profile?.headline ?? null,
    links: (profile?.links ?? []) as TeamProfileLink[],
    managerName: row.manager ? `${row.manager.firstName} ${row.manager.lastName}` : null,
    joiningDate: row.joiningDate.toISOString().slice(0, 10),
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
   * Everyone with `team_profile.view` sees everyone: that is what a staff directory is, and it is
   * why the card carries no private field. Employee scopes (OWN, TEAM) do not apply here.
   */
  async list(query: TeamProfileQuery) {
    const where: Prisma.EmployeeWhereInput = {
      ...LISTED,
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.workLocation ? { workLocation: query.workLocation } : {}),
      ...(query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { employeeCode: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
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

    return { data: rows.map(toListItem), meta: pageMeta(query.page, query.limit, total) };
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
      links: (row.teamProfile?.links ?? []) as TeamProfileLink[],
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
