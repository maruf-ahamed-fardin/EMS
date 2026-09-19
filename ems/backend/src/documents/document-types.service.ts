import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateDocumentTypeInput, DocumentTypeItem, UpdateDocumentTypeInput } from '@ems/contracts';
import { AuditService } from '../audit/audit.service';
import { conflict } from '../common/errors/http-errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_SELECT = {
  id: true,
  name: true,
  code: true,
  isSensitive: true,
  hasExpiry: true,
  _count: { select: { documents: { where: { deletedAt: null } } } },
} satisfies Prisma.DocumentTypeSelect;

type TypeRow = Prisma.DocumentTypeGetPayload<{ select: typeof TYPE_SELECT }>;

function toItem(row: TypeRow): DocumentTypeItem {
  return { id: row.id, name: row.name, code: row.code, isSensitive: row.isSensitive, hasExpiry: row.hasExpiry, documentCount: row._count.documents };
}

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<DocumentTypeItem[]> {
    const rows = await this.prisma.documentType.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: TYPE_SELECT });
    return rows.map(toItem);
  }

  async create(input: CreateDocumentTypeInput): Promise<DocumentTypeItem> {
    const data = input as Required<CreateDocumentTypeInput>;
    await this.assertUnique(data.name, data.code);
    const id = await this.prisma.$transaction(async (tx) => {
      const row = await tx.documentType.create({ data, select: { id: true } });
      await this.audit.record({ action: 'document_type.created', entityType: 'document_type', entityId: row.id, after: { ...data } }, tx);
      return row.id;
    });
    return this.get(id);
  }

  /** Making a type sensitive hides its existing documents from managers straight away. */
  async update(id: string, input: UpdateDocumentTypeInput): Promise<DocumentTypeItem> {
    const current = await this.load(id);
    if (input.name !== undefined || input.code !== undefined) await this.assertUnique(input.name, input.code, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.documentType.update({ where: { id }, data: input });
      await this.audit.record(
        {
          action: 'document_type.updated',
          entityType: 'document_type',
          entityId: id,
          before: Object.fromEntries(Object.keys(input).map((k) => [k, toItem(current)[k as keyof DocumentTypeItem]])),
          after: { ...input },
        },
        tx,
      );
    });
    return this.get(id);
  }

  /** Soft delete, and only when no document uses the type: deleting it would orphan their label. */
  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    const count = current._count.documents;
    if (count > 0) throw conflict(`${count} ${count === 1 ? 'document uses' : 'documents use'} ${current.name}. Delete or move them first.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.documentType.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record({ action: 'document_type.deleted', entityType: 'document_type', entityId: id, before: { name: current.name, code: current.code } }, tx);
    });
  }

  private async get(id: string): Promise<DocumentTypeItem> {
    return toItem(await this.prisma.documentType.findUniqueOrThrow({ where: { id }, select: TYPE_SELECT }));
  }

  private async load(id: string): Promise<TypeRow> {
    const row = UUID.test(id) ? await this.prisma.documentType.findFirst({ where: { id, deletedAt: null }, select: TYPE_SELECT }) : null;
    if (!row) throw new NotFoundException();
    return row;
  }

  private async assertUnique(name?: string, code?: string, excludeId?: string): Promise<void> {
    const notSelf = excludeId ? { id: { not: excludeId } } : {};
    const errors: Record<string, string> = {};
    if (name && (await this.prisma.documentType.count({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null, ...notSelf } }))) {
      errors.name = 'Another document type already has this name';
    }
    if (code && (await this.prisma.documentType.count({ where: { code, deletedAt: null, ...notSelf } }))) {
      errors.code = 'Another document type already uses this code';
    }
    if (Object.keys(errors).length > 0) throw conflict('Some details are already used by another document type', errors);
  }
}
