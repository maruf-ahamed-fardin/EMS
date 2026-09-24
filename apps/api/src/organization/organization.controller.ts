import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  can,
  createDepartmentInput,
  createPositionInput,
  type DataResponse,
  type DepartmentDetail,
  type DepartmentHeadOption,
  type DepartmentListItem,
  departmentListQuery,
  type PositionListItem,
  positionListQuery,
  updateDepartmentInput,
  updatePositionInput,
} from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { DepartmentsService } from './departments.service';
import { PositionsService } from './positions.service';

class DepartmentListQueryDto extends createZodDto(departmentListQuery) {}
class CreateDepartmentDto extends createZodDto(createDepartmentInput) {}
class UpdateDepartmentDto extends createZodDto(updateDepartmentInput) {}
class PositionListQueryDto extends createZodDto(positionListQuery) {}
class CreatePositionDto extends createZodDto(createPositionInput) {}
class UpdatePositionDto extends createZodDto(updatePositionInput) {}

/**
 * Departments are organization structure, not personal data: everyone with department.view sees all
 * of them (plan §4). Who works in one is answered by the scoped employee list.
 */
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @RequirePermission('department.view')
  @Get()
  async list(@Query() query: DepartmentListQueryDto): Promise<DataResponse<DepartmentListItem[]>> {
    return { data: await this.departments.list(query) };
  }

  /** Active employees to choose a head from. Needs department.create or department.update. */
  @Get('head-options')
  async headOptions(@CurrentAuth() auth: AuthContext): Promise<DataResponse<DepartmentHeadOption[]>> {
    if (!can(auth.permissions, 'department.create') && !can(auth.permissions, 'department.update')) throw new ForbiddenException();
    return { data: await this.departments.headOptions() };
  }

  @RequirePermission('department.create')
  @Post()
  async create(@CurrentAuth() auth: AuthContext, @Body() body: CreateDepartmentDto): Promise<DataResponse<DepartmentDetail>> {
    return { data: await this.departments.create(auth, body) };
  }

  @RequirePermission('department.view')
  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<DepartmentDetail>> {
    return { data: await this.departments.get(auth, id) };
  }

  @RequirePermission('department.update')
  @Patch(':id')
  async update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: UpdateDepartmentDto): Promise<DataResponse<DepartmentDetail>> {
    return { data: await this.departments.update(auth, id, body) };
  }

  @RequirePermission('department.delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.departments.remove(id);
  }
}

@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @RequirePermission('position.view')
  @Get()
  async list(@Query() query: PositionListQueryDto): Promise<DataResponse<PositionListItem[]>> {
    return { data: await this.positions.list(query) };
  }

  @RequirePermission('position.manage')
  @Post()
  async create(@Body() body: CreatePositionDto): Promise<DataResponse<PositionListItem>> {
    return { data: await this.positions.create(body) };
  }

  @RequirePermission('position.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePositionDto): Promise<DataResponse<PositionListItem>> {
    return { data: await this.positions.update(id, body) };
  }

  @RequirePermission('position.manage')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.positions.remove(id);
  }
}
