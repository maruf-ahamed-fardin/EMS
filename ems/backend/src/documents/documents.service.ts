import { createHash } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DOCUMENT_EXPIRY_WARNING_DAYS,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_URL_TTL_SECONDS,
  type DocumentExpiry,
  type DocumentItem,
  type DocumentListQuery,
  type DocumentMimeType,
  type DocumentUrl,
  type ListResponse,
  pageMeta,
  type UploadDocumentFields,
  uploadDocumentFields,
} from '@ems/contracts';
import { v7 as uuidv7 } from 'uuid';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth-context';
import { ScopeService } from '../auth/scope.service';
import { CalendarService } from '../calendar/calendar.service';
import { addDays, dateOnly } from '../calendar/work-calendar';
import { Clock } from '../common/clock';
import { invalidFields } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sniffDocumentType } from './sniff';
import { DOCUMENT_STORAGE, type DocumentStorage } from './storage/storage';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What multer hands over for one file. Only the bytes are trusted. */
export interface UploadedDocumentFile {
  buffer: Buffer;
  size: number;
}

/** Everything a client may see. `storageKey` and `sha256` are deliberately not here. */
const DOCUMENT_SELECT = {
  id: true,
  title: true,
  mimeType: true,
  sizeBytes: true,
  expiresAt: true,
  createdAt: true,
  employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, managerId: true } },
  documentType: { select: { id: true, name: true, isSensitive: true, hasExpiry: true } },
  uploadedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.DocumentSelect;

type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>;

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function expiryOf(expiresAt: string | null, today: string): DocumentExpiry | null {
  if (!expiresAt) return null;
  if (expiresAt < today) return 'EXPIRED';
  return expiresAt <= addDays(today, DOCUMENT_EXPIRY_WARNING_DAYS) ? 'EXPIRING' : 'VALID';
}

/** A safe download name from the title: no path characters or control codes, with the real extension. */
export function downloadName(title: string, mimeType: DocumentMimeType): string {
  const unsafe = (c: string) => c.charCodeAt(0) < 32 || c === '\u007f' || '/\\:*?"<>|'.includes(c);
  const cleaned = Array.from(title, (c) => (unsafe(c) ? '-' : c)).join('');
  const base = cleaned.replace(/-{2,}/g, '-').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '').slice(0, 100) || 'document';
  return `${base}.${DOCUMENT_MIME_TYPES[mimeType].extension}`;
}

/**
 * Documents the viewer may see (plan §4): the employee is in their `document.view` scope, and a
 * sensitive type (such as a national ID) also needs `employee.view_private` for that person. So a
 * manager never sees their team's IDs, and an employee sees all of their own. The dashboard counts
 * with the same rule.
 */
export function documentVisibleWhere(scope: ScopeService, auth: AuthContext): Prisma.DocumentWhereInput {
  return {
    deletedAt: null,
    AND: [
      { employee: scope.employeeWhere(auth, 'document.view') },
      { OR: [{ documentType: { isSensitive: false } }, { employee: scope.employeeWhere(auth, 'employee.view_private') }] },
    ],
  };
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
    private readonly audit: AuditService,
    private readonly calendar: CalendarService,
    private readonly clock: Clock,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
  ) {}

  visibleWhere(auth: AuthContext): Prisma.DocumentWhereInput {
    return documentVisibleWhere(this.scope, auth);
  }

  // ─── Reading ────────────────────────────────────────────────────────────────────────────────

  /** One employee's documents. 404 when the employee is outside the viewer's `document.view` scope. */
  async listForEmployee(auth: AuthContext, employeeId: string): Promise<DocumentItem[]> {
    await this.requireEmployee(auth, 'document.view', employeeId);
    const rows = await this.prisma.document.findMany({
      where: { AND: [this.visibleWhere(auth), { employeeId }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: DOCUMENT_SELECT,
    });
    return this.toItems(auth, rows);
  }

  async list(auth: AuthContext, query: DocumentListQuery): Promise<ListResponse<DocumentItem>> {
    const today = await this.calendar.today(this.clock.now());
    const filters: Prisma.DocumentWhereInput[] = [this.visibleWhere(auth)];
    if (query.employeeId) filters.push({ employeeId: query.employeeId });
    if (query.documentTypeId) filters.push({ documentTypeId: query.documentTypeId });
    if (query.expiry === 'EXPIRING') filters.push({ expiresAt: { gte: dateOnly(today), lte: dateOnly(addDays(today, DOCUMENT_EXPIRY_WARNING_DAYS)) } });
    if (query.expiry === 'EXPIRED') filters.push({ expiresAt: { lt: dateOnly(today) } });
    if (query.q) {
      const contains = { contains: query.q, mode: 'insensitive' as const };
      filters.push({
        OR: [
          { title: contains },
          { employee: { OR: [{ firstName: contains }, { lastName: contains }, { employeeCode: contains }] } },
          { documentType: { name: contains } },
        ],
      });
    }
    const where: Prisma.DocumentWhereInput = { AND: filters };
    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        // Expiry views show the most urgent first; otherwise the newest
        orderBy: query.expiry ? [{ expiresAt: 'asc' }, { id: 'asc' }] : [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: DOCUMENT_SELECT,
      }),
      this.prisma.document.count({ where }),
    ]);
    return { data: await this.toItems(auth, rows, today), meta: pageMeta(query.page, query.limit, total) };
  }

  private async toItems(auth: AuthContext, rows: DocumentRow[], today?: string): Promise<DocumentItem[]> {
    const day = today ?? (await this.calendar.today(this.clock.now()));
    return rows.map((row) => {
      const expiresAt = row.expiresAt ? iso(row.expiresAt) : null;
      return {
        id: row.id,
        employee: { id: row.employee.id, name: `${row.employee.firstName} ${row.employee.lastName}`, employeeCode: row.employee.employeeCode },
        documentType: row.documentType,
        title: row.title,
        mimeType: row.mimeType as DocumentMimeType,
        sizeBytes: row.sizeBytes,
        expiresAt,
        expiry: expiryOf(expiresAt, day),
        uploadedBy: row.uploadedBy.employee ? `${row.uploadedBy.employee.firstName} ${row.uploadedBy.employee.lastName}` : row.uploadedBy.email,
        uploadedAt: row.createdAt.toISOString(),
        allowedActions: { delete: this.scope.reaches(auth, 'document.delete', { id: row.employee.id, managerId: row.employee.managerId }) },
      };
    });
  }

  // ─── Upload ─────────────────────────────────────────────────────────────────────────────────

  /**
   * Stores the file, then records it (plan §7). The type is read from the bytes; the key is
   * `employees/{employeeId}/{uuidv7}`, never the original name. If recording fails, the file is removed.
   */
  async upload(auth: AuthContext, employeeId: string, rawFields: UploadDocumentFields, file: UploadedDocumentFile | undefined): Promise<DocumentItem> {
    const employee = await this.requireEmployee(auth, 'document.upload', employeeId);
    const parsed = uploadDocumentFields.safeParse(rawFields);
    if (!parsed.success) {
      throw invalidFields(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join('.'), issue.message])));
    }
    const fields = parsed.data;
    if (!file || file.size === 0) throw invalidFields({ file: 'Choose a file to upload' });

    const type = await this.prisma.documentType.findFirst({ where: { id: fields.documentTypeId, deletedAt: null }, select: { id: true, isSensitive: true, hasExpiry: true, name: true } });
    if (!type) throw invalidFields({ documentTypeId: 'Choose a document type' });
    // Nobody adds a document they wouldn't be allowed to open
    if (type.isSensitive && !this.scope.reaches(auth, 'employee.view_private', employee)) {
      throw invalidFields({ documentTypeId: `You can't add ${type.name} documents for this person` });
    }
    if (type.hasExpiry && !fields.expiresAt) throw invalidFields({ expiresAt: `${type.name} documents need an expiry date` });

    const mimeType = sniffDocumentType(file.buffer);
    if (!mimeType) throw invalidFields({ file: 'Upload a PDF, PNG, JPEG or Word (.docx) file' });

    const storageKey = `employees/${employeeId}/${uuidv7()}`;
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const expiresAt = type.hasExpiry ? fields.expiresAt! : null;
    await this.storage.put(storageKey, file.buffer, mimeType);

    let id: string;
    try {
      id = await this.prisma.$transaction(async (tx) => {
        const row = await tx.document.create({
          data: { employeeId, documentTypeId: type.id, title: fields.title, storageKey, mimeType, sizeBytes: file.size, sha256, expiresAt: expiresAt ? dateOnly(expiresAt) : null, uploadedById: auth.user.id },
          select: { id: true },
        });
        await this.audit.record(
          { action: 'document.uploaded', entityType: 'document', entityId: row.id, after: { employeeId, documentTypeId: type.id, title: fields.title, mimeType, sizeBytes: file.size, expiresAt } },
          tx,
        );
        return row.id;
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch((cleanup: unknown) => this.logger.warn({ err: cleanup }, 'Could not remove an unrecorded upload'));
      throw error;
    }
    return this.get(auth, id);
  }

  async get(auth: AuthContext, id: string): Promise<DocumentItem> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.document.findFirst({ where: { AND: [this.visibleWhere(auth), { id }] }, select: DOCUMENT_SELECT });
    if (!row) throw new NotFoundException();
    return (await this.toItems(auth, [row]))[0]!;
  }

  // ─── Access and delete ──────────────────────────────────────────────────────────────────────

  /** A 60-second download link, audited as `document.accessed`. 404 for anything the viewer can't see. */
  async url(auth: AuthContext, id: string): Promise<DocumentUrl> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.document.findFirst({
      where: { AND: [this.visibleWhere(auth), { id }] },
      select: { id: true, title: true, mimeType: true, storageKey: true, employeeId: true },
    });
    if (!row) throw new NotFoundException();

    const now = this.clock.now();
    const mimeType = row.mimeType as DocumentMimeType;
    const url = await this.storage.signedUrl(row.storageKey, { filename: downloadName(row.title, mimeType), contentType: mimeType, expiresInSeconds: DOCUMENT_URL_TTL_SECONDS, now });
    await this.audit.record({ action: 'document.accessed', entityType: 'document', entityId: row.id, after: { employeeId: row.employeeId, title: row.title } });
    return { url, expiresAt: new Date(now.getTime() + DOCUMENT_URL_TTL_SECONDS * 1000).toISOString() };
  }

  /** Soft delete (plan §7, assumption 10). The file stays in storage with the row, for the record. */
  async remove(auth: AuthContext, id: string): Promise<void> {
    if (!UUID.test(id)) throw new NotFoundException();
    const row = await this.prisma.document.findFirst({
      where: { AND: [this.visibleWhere(auth), { id }] },
      select: { id: true, title: true, employeeId: true, documentTypeId: true, employee: { select: { managerId: true } } },
    });
    if (!row) throw new NotFoundException();
    if (!this.scope.reaches(auth, 'document.delete', { id: row.employeeId, managerId: row.employee.managerId })) throw new ForbiddenException();

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.document.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: this.clock.now() } });
      if (deleted.count !== 1) throw new NotFoundException();
      await this.audit.record(
        { action: 'document.deleted', entityType: 'document', entityId: id, before: { employeeId: row.employeeId, documentTypeId: row.documentTypeId, title: row.title } },
        tx,
      );
    });
  }

  private async requireEmployee(auth: AuthContext, key: 'document.view' | 'document.upload', employeeId: string) {
    if (!UUID.test(employeeId)) throw new NotFoundException();
    const employee = await this.prisma.employee.findFirst({ where: this.scope.employeeById(auth, key, employeeId), select: { id: true, managerId: true } });
    if (employee) return employee;
    // Someone who can see the person but not upload for them is refused; anyone else gets 404
    if (key === 'document.upload' && (await this.prisma.employee.count({ where: this.scope.employeeById(auth, 'document.view', employeeId) }))) {
      throw new ForbiddenException();
    }
    throw new NotFoundException();
  }
}
