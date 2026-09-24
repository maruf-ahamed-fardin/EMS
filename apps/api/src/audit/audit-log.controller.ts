import { Controller, Get, Param, Query } from '@nestjs/common';
import { type AuditDetail, type AuditListItem, auditListQuery, type DataResponse, type ListResponse } from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { AuditLogService } from './audit-log.service';

class AuditListQueryDto extends createZodDto(auditListQuery) {}

/** The audit log viewer. Everything in it is organization-wide, so only `audit.view` at ALL may read it. */
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @RequirePermission('audit.view', 'ALL')
  @Get()
  list(@Query() query: AuditListQueryDto): Promise<ListResponse<AuditListItem>> {
    return this.auditLog.list(query);
  }

  @RequirePermission('audit.view', 'ALL')
  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<AuditDetail>> {
    return { data: await this.auditLog.get(auth, id) };
  }
}
