import { Injectable, NotFoundException } from '@nestjs/common';
import { type AuditChange, type AuditDetail, type AuditListItem, type AuditListQuery, type ListResponse, pageMeta } from '@/lib/validations';
import type { AuthContext } from '@/lib/auth/auth-context';
import { CalendarService } from '@/lib/services/calendar/calendar.service';
import { addDays, zonedTime } from '@/lib/services/calendar/work-calendar';
import type { Prisma } from '@/lib/db/generated/prisma/client';
import { PrismaService } from '@/lib/db/prisma';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Employee fields only people with `employee.view_private` for everyone may read, here as on the profile. */
const PRIVATE_EMPLOYEE_FIELDS = new Set(['dateOfBirth', 'gender', 'address', 'emergencyContact']);

const ROW_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  before: true,
  after: true,
  ip: true,
  userAgent: true,
  requestId: true,
  createdAt: true,
  actor: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.AuditLogSelect;

type Row = Prisma.AuditLogGetPayload<{ select: typeof ROW_SELECT }>;

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** Field by field: what it was and what it became, in a stable order. */
export function diff(before: unknown, after: unknown): AuditChange[] {
  const b = asObject(before);
  const a = asObject(after);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].sort().map((field) => ({ field, before: field in b ? b[field] : null, after: field in a ? a[field] : null }));
}

/**
 * Reads the audit log for the viewer (plan §8). Entries are never changed here; the only writer is
 * AuditService, inside the transactions it describes.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: CalendarService,
  ) {}

  async list(query: AuditListQuery): Promise<ListResponse<AuditListItem>> {
    const where = await this.where(query);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit, select: ROW_SELECT }),
      this.prisma.auditLog.count({ where }),
    ]);
    const labels = await this.labels(rows);
    return { data: rows.map((row) => this.toItem(row, labels)), meta: pageMeta(query.page, query.limit, total) };
  }

  async get(auth: AuthContext, id: string): Promise<AuditDetail> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.auditLog.findUnique({ where: { id }, select: ROW_SELECT });
    if (!row) throw new NotFoundException();
    const labels = await this.labels([row]);
    const seesPrivate = auth.permissions['employee.view_private'] === 'ALL';
    const changes = diff(row.before, row.after).map((change) =>
      row.entityType === 'employee' && PRIVATE_EMPLOYEE_FIELDS.has(change.field) && !seesPrivate ? { field: change.field, before: null, after: null, hidden: true } : change,
    );
    return { ...this.toItem(row, labels), changes, ip: row.ip, userAgent: row.userAgent, requestId: row.requestId };
  }

  private async where(query: AuditListQuery): Promise<Prisma.AuditLogWhereInput> {
    const { timeZone } = await this.calendar.settings();
    return {
      AND: [
        query.action ? { action: query.action } : {},
        query.entityType ? { entityType: query.entityType } : {},
        query.entityId ? { entityId: query.entityId } : {},
        query.actorUserId ? { actorUserId: query.actorUserId } : {},
        // Whole days in the organization's time zone
        query.from ? { createdAt: { gte: zonedTime(query.from, '00:00', timeZone) } } : {},
        query.to ? { createdAt: { lt: zonedTime(addDays(query.to, 1), '00:00', timeZone) } } : {},
      ],
    };
  }

  private toItem(row: Row, labels: Map<string, string>): AuditListItem {
    const name = row.actor?.employee ? `${row.actor.employee.firstName} ${row.actor.employee.lastName}` : row.actor?.email;
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel: row.entityId ? (labels.get(`${row.entityType}:${row.entityId}`) ?? null) : null,
      actor: row.actor ? { id: row.actor.id, name: name!, email: row.actor.email } : null,
      changedFields: diff(row.before, row.after).map((c) => c.field),
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Names for the records a page of entries is about, one query per kind. Deleted records keep their name. */
  private async labels(rows: Row[]): Promise<Map<string, string>> {
    const ids = (type: string) => [...new Set(rows.filter((r) => r.entityType === type && r.entityId && UUID.test(r.entityId)).map((r) => r.entityId!))];
    const labels = new Map<string, string>();
    const put = (type: string, id: string, label: string) => labels.set(`${type}:${id}`, label);

    const [employees, departments, positions, leaveTypes, documentTypes, documents, users, requests] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: ids('employee') } }, select: { id: true, firstName: true, lastName: true, employeeCode: true } }),
      this.prisma.department.findMany({ where: { id: { in: ids('department') } }, select: { id: true, name: true } }),
      this.prisma.position.findMany({ where: { id: { in: ids('position') } }, select: { id: true, title: true } }),
      this.prisma.leaveType.findMany({ where: { id: { in: ids('leave_type') } }, select: { id: true, name: true } }),
      this.prisma.documentType.findMany({ where: { id: { in: ids('document_type') } }, select: { id: true, name: true } }),
      this.prisma.document.findMany({ where: { id: { in: ids('document') } }, select: { id: true, title: true, employee: { select: { firstName: true, lastName: true } } } }),
      this.prisma.user.findMany({ where: { id: { in: ids('user') } }, select: { id: true, email: true } }),
      this.prisma.leaveRequest.findMany({ where: { id: { in: ids('leave_request') } }, select: { id: true, employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { name: true } } } }),
    ]);
    for (const e of employees) put('employee', e.id, `${e.firstName} ${e.lastName} (${e.employeeCode})`);
    for (const d of departments) put('department', d.id, d.name);
    for (const p of positions) put('position', p.id, p.title);
    for (const t of leaveTypes) put('leave_type', t.id, t.name);
    for (const t of documentTypes) put('document_type', t.id, t.name);
    for (const d of documents) put('document', d.id, `${d.title}, ${d.employee.firstName} ${d.employee.lastName}`);
    for (const u of users) put('user', u.id, u.email);
    for (const r of requests) put('leave_request', r.id, `${r.leaveType.name} leave, ${r.employee.firstName} ${r.employee.lastName}`);
    return labels;
  }
}
