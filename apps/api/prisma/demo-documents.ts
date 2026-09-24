import { createHash } from 'node:crypto';
import { v7 as uuidv7 } from 'uuid';
import { addDays, dateOnly, zonedDate } from '../src/calendar/work-calendar';
import type { DocumentStorage } from '../src/documents/storage/storage';
import type { PrismaClient } from '../src/generated/prisma/client';
import { DEMO_DOMAIN } from './demo-data';
import { simplePdf } from './sample-files';

const DOCUMENT_TYPES = [
  { code: 'NATIONAL_ID', name: 'National ID', isSensitive: true, hasExpiry: false },
  { code: 'PASSPORT', name: 'Passport', isSensitive: true, hasExpiry: true },
  { code: 'CONTRACT', name: 'Employment contract', isSensitive: false, hasExpiry: false },
  { code: 'CERTIFICATE', name: 'Educational certificate', isSensitive: false, hasExpiry: false },
  { code: 'DRIVING_LICENCE', name: 'Driving licence', isSensitive: false, hasExpiry: true },
] as const;

type TypeCode = (typeof DOCUMENT_TYPES)[number]['code'];

/**
 * Demo documents (plan §14): document types, and generated one-page PDFs for every demo employee: a
 * contract and national ID each, passports for some, and driving licences in Sales. A few expire
 * within 30 days and a couple have expired, so the expiry views and reminders have something to show.
 *
 * Development data only. It replaces the documents of demo employees each time, removing their old
 * files from storage too.
 */
export async function seedDemoDocuments(prisma: PrismaClient, storage: DocumentStorage, now = new Date(), timeZone = 'Asia/Dhaka') {
  const today = zonedDate(now, timeZone);

  const types = new Map<TypeCode, string>();
  for (const type of DOCUMENT_TYPES) {
    const existing = await prisma.documentType.findFirst({ where: { code: type.code, deletedAt: null }, select: { id: true } });
    const row = existing
      ? await prisma.documentType.update({ where: { id: existing.id }, data: type, select: { id: true } })
      : await prisma.documentType.create({ data: type, select: { id: true } });
    types.set(type.code, row.id);
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, email: { endsWith: `@${DEMO_DOMAIN}` } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, joiningDate: true, department: { select: { code: true } } },
    orderBy: { employeeCode: 'asc' },
  });
  const hr = await prisma.user.findUniqueOrThrow({ where: { email: `hr@${DEMO_DOMAIN}` }, select: { id: true } });

  // Start clean for demo employees only, files included
  const old = await prisma.document.findMany({ where: { employeeId: { in: employees.map((e) => e.id) } }, select: { storageKey: true } });
  for (const { storageKey } of old) await storage.delete(storageKey);
  await prisma.document.deleteMany({ where: { employeeId: { in: employees.map((e) => e.id) } } });

  const plans: Array<{ employeeId: string; type: TypeCode; title: string; expiresAt: string | null; lines: string[]; uploadedAt: Date }> = [];
  employees.forEach((employee, index) => {
    const name = `${employee.firstName} ${employee.lastName}`;
    const joined = employee.joiningDate.toISOString().slice(0, 10);
    const uploadedAt = new Date(`${joined}T10:00:00+06:00`);
    const expiring = (days: number) => addDays(today, days);

    plans.push({ employeeId: employee.id, type: 'CONTRACT', title: `Employment contract ${joined.slice(0, 4)}`, expiresAt: null, lines: ['Employment contract', name, `Start date ${joined}`], uploadedAt });
    if (index % 6 !== 5) {
      plans.push({ employeeId: employee.id, type: 'NATIONAL_ID', title: 'National ID card', expiresAt: null, lines: ['National ID card (demo)', name], uploadedAt });
    }
    if (index % 3 === 0) {
      // Spread passport expiry: a few within 30 days, one or two already expired, the rest years away
      const expiresAt = index % 21 === 0 ? expiring(-10 - index) : index % 9 === 0 ? expiring(3 + (index % 25)) : expiring(400 + index * 20);
      plans.push({ employeeId: employee.id, type: 'PASSPORT', title: 'Passport', expiresAt, lines: ['Passport (demo)', name, `Valid until ${expiresAt}`], uploadedAt });
    }
    if (index % 4 === 1) {
      plans.push({ employeeId: employee.id, type: 'CERTIFICATE', title: 'Bachelor’s degree certificate', expiresAt: null, lines: ['Degree certificate (demo)', name], uploadedAt });
    }
    if (employee.department.code === 'SAL') {
      const expiresAt = index % 5 === 0 ? expiring(20) : expiring(700);
      plans.push({ employeeId: employee.id, type: 'DRIVING_LICENCE', title: 'Driving licence', expiresAt, lines: ['Driving licence (demo)', name, `Valid until ${expiresAt}`], uploadedAt });
    }
  });

  for (const plan of plans) {
    const content = simplePdf([...plan.lines, '', 'Generated demo data. Not a real document.']);
    const storageKey = `employees/${plan.employeeId}/${uuidv7()}`;
    await storage.put(storageKey, content, 'application/pdf');
    await prisma.document.create({
      data: {
        employeeId: plan.employeeId,
        documentTypeId: types.get(plan.type)!,
        title: plan.title,
        storageKey,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
        expiresAt: plan.expiresAt ? dateOnly(plan.expiresAt) : null,
        uploadedById: hr.id,
        createdAt: plan.uploadedAt,
      },
    });
  }

  const soon = plans.filter((p) => p.expiresAt && p.expiresAt >= today && p.expiresAt <= addDays(today, 30)).length;
  const expired = plans.filter((p) => p.expiresAt && p.expiresAt < today).length;
  return { documents: plans.length, expiringSoon: soon, expired };
}
