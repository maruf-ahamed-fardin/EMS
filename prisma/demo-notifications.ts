import { addDays, dateOnly, zonedDate } from '@/lib/services/calendar/work-calendar';
import { reminderStage, when } from '@/lib/services/documents/document-expiry';
import type { PrismaClient } from '@/lib/db/generated/prisma/client';
import { InAppChannel, NotificationService } from '@/lib/services/notifications/notifications.service';
import { dateRange, days } from '@/lib/services/notifications/wording';
import type { PrismaService } from '@/lib/db/prisma';
import { DEMO_DOMAIN } from './demo-data';

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Demo notifications (plan §14) for the events the other demo seeds created: pending leave for the
 * approvers, recent decisions for the employees, new joiners for HR and documents about to expire.
 * They go through the real NotificationService, so recipients follow the same rules as the app.
 * Older ones are marked read. Development data only; demo users' notifications are replaced each run.
 */
export async function seedDemoNotifications(prisma: PrismaClient, now = new Date(), timeZone = 'Asia/Dhaka') {
  const service = new NotificationService(prisma as unknown as PrismaService, [new InAppChannel()]);
  const today = zonedDate(now, timeZone);
  await prisma.notification.deleteMany({ where: { user: { email: { endsWith: `@${DEMO_DOMAIN}` } } } });

  /** Notifies, then backdates what was just written to when the event happened. */
  const at = async (time: Date, read: boolean, input: Parameters<NotificationService['notify']>[0]) => {
    await service.notify(input);
    await prisma.notification.updateMany({ where: { dedupeKey: input.dedupeKey }, data: { createdAt: time, readAt: read ? new Date(time.getTime() + 3_600_000) : null } });
  };

  const approvers = await service.usersWithAll('leave.approve');
  const requests = await prisma.leaveRequest.findMany({
    where: { employee: { email: { endsWith: `@${DEMO_DOMAIN}` } }, OR: [{ status: 'PENDING' }, { reviewedAt: { gte: new Date(now.getTime() - 14 * 86_400_000) } }] },
    select: {
      id: true, status: true, startDate: true, endDate: true, days: true, reason: true, reviewNote: true, createdAt: true, reviewedAt: true, employeeId: true,
      employee: { select: { firstName: true, lastName: true, managerId: true, user: { select: { id: true } } } },
      leaveType: { select: { name: true } },
    },
  });
  for (const r of requests) {
    const range = dateRange(iso(r.startDate), iso(r.endDate));
    const manager = await service.accountOf(r.employee.managerId, 'leave.approve');
    await at(r.createdAt, r.status !== 'PENDING', {
      userIds: [...approvers, ...(manager ? [manager] : [])].filter((id) => id !== r.employee.user?.id),
      type: 'leave.requested',
      title: `${r.employee.firstName} ${r.employee.lastName} asked for ${days(Number(r.days))} of ${r.leaveType.name} leave`,
      body: `${range}: ${r.reason}`,
      link: '/leave/requests',
      entity: { type: 'leave_request', id: r.id },
      dedupeKey: `leave-requested:${r.id}`,
    });
    if (r.status === 'APPROVED' || r.status === 'REJECTED') {
      const account = r.employee.user?.id;
      if (!account) continue;
      const decision = r.status === 'APPROVED' ? 'approved' : 'rejected';
      await at(r.reviewedAt ?? r.createdAt, false, {
        userIds: [account],
        type: decision === 'approved' ? 'leave.approved' : 'leave.rejected',
        title: `Your ${r.leaveType.name} leave was ${decision}`,
        body: `${range}, ${days(Number(r.days))}.${r.reviewNote ? ` Reason: ${r.reviewNote}` : ''}`,
        link: '/leave',
        entity: { type: 'leave_request', id: r.id },
        dedupeKey: `leave-decided:${r.id}`,
      });
    }
  }

  // The three most recent joiners, announced to HR
  const hr = await service.usersWithAll('employee.view');
  const joiners = await prisma.employee.findMany({
    where: { email: { endsWith: `@${DEMO_DOMAIN}` }, deletedAt: null },
    orderBy: { joiningDate: 'desc' },
    take: 3,
    select: { id: true, firstName: true, lastName: true, employeeCode: true, joiningDate: true, department: { select: { name: true } }, position: { select: { title: true } } },
  });
  for (const [index, e] of joiners.entries()) {
    await at(new Date(e.joiningDate.getTime() - 7 * 86_400_000), index > 0, {
      userIds: hr,
      type: 'employee.created',
      title: `${e.firstName} ${e.lastName} joins ${e.department.name}`,
      body: `${e.employeeCode} · ${e.position.title} · starts ${dateRange(iso(e.joiningDate), iso(e.joiningDate))}`,
      link: `/employees/${e.id}`,
      entity: { type: 'employee', id: e.id },
      dedupeKey: `employee-created:${e.id}`,
    });
  }

  // Documents expiring soon, as the reminder job would have sent them
  const documentHr = await service.usersWithAll('document.view');
  const privateHr = new Set(await service.usersWithAll('employee.view_private'));
  const expiring = await prisma.document.findMany({
    where: { deletedAt: null, expiresAt: { gte: dateOnly(today), lte: dateOnly(addDays(today, 30)) }, employee: { email: { endsWith: `@${DEMO_DOMAIN}` } } },
    select: { id: true, title: true, expiresAt: true, employeeId: true, employee: { select: { firstName: true, lastName: true, user: { select: { id: true } } } }, documentType: { select: { name: true, isSensitive: true } } },
  });
  for (const d of expiring) {
    const left = Math.round((d.expiresAt!.getTime() - dateOnly(today).getTime()) / 86_400_000);
    const stage = reminderStage(left);
    if (stage === null) continue;
    const owner = d.employee.user?.id ?? null;
    await at(now, false, {
      userIds: documentHr.filter((id) => id !== owner && (!d.documentType.isSensitive || privateHr.has(id))),
      type: 'document.expiring',
      title: `${d.documentType.name} for ${d.employee.firstName} ${d.employee.lastName} expires ${when(left)}`,
      body: `"${d.title}" expires on ${iso(d.expiresAt!)}.`,
      link: `/employees/${d.employeeId}?tab=documents`,
      entity: { type: 'document', id: d.id },
      dedupeKey: `document-expiry:${d.id}:${stage}`,
    });
  }

  const total = await prisma.notification.count({ where: { user: { email: { endsWith: `@${DEMO_DOMAIN}` } } } });
  const unread = await prisma.notification.count({ where: { readAt: null, user: { email: { endsWith: `@${DEMO_DOMAIN}` } } } });
  return { total, unread };
}
