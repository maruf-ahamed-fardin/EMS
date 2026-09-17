import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  checkUniqueQuery,
  createEmployeeInput,
  type DataResponse,
  type EmployeeActivityItem,
  type EmployeeDetail,
  type EmployeeFormOptions,
  type EmployeeListItem,
  employeeListQuery,
  type ListResponse,
  paginationQuery,
  type UniquenessResult,
  updateEmployeeInput,
  updateMyProfileInput,
} from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { EmployeesService } from './employees.service';

class EmployeeListQueryDto extends createZodDto(employeeListQuery) {}
class CheckUniqueQueryDto extends createZodDto(checkUniqueQuery) {}
class PaginationQueryDto extends createZodDto(paginationQuery) {}
class CreateEmployeeDto extends createZodDto(createEmployeeInput) {}
class UpdateEmployeeDto extends createZodDto(updateEmployeeInput) {}
class UpdateMyProfileDto extends createZodDto(updateMyProfileInput) {}

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @RequirePermission('employee.view')
  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: EmployeeListQueryDto): Promise<ListResponse<EmployeeListItem>> {
    return this.employees.list(auth, query);
  }

  // Static paths are declared before ':id' so they aren't read as an id.

  /** Departments, positions, managers and roles for the create and edit forms. Needs create or update. */
  @Get('form-options')
  async formOptions(@CurrentAuth() auth: AuthContext): Promise<DataResponse<EmployeeFormOptions>> {
    return { data: await this.employees.formOptions(auth) };
  }

  /** Live availability of an email or employee ID while a form is being filled in. Needs create or update. */
  @Get('check-unique')
  async checkUnique(@CurrentAuth() auth: AuthContext, @Query() query: CheckUniqueQueryDto): Promise<DataResponse<UniquenessResult>> {
    return { data: await this.employees.checkUnique(auth, query) };
  }

  @RequirePermission('employee.create')
  @Post()
  async create(@CurrentAuth() auth: AuthContext, @Body() body: CreateEmployeeDto): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.create(auth, body) };
  }

  @RequirePermission('employee.view')
  @Get(':id')
  async get(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.get(auth, id) };
  }

  @RequirePermission('employee.update')
  @Patch(':id')
  async update(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: UpdateEmployeeDto): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.update(auth, id, body) };
  }

  @RequirePermission('employee.update')
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.deactivate(auth, id) };
  }

  @RequirePermission('employee.update')
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.reactivate(auth, id) };
  }

  @RequirePermission('employee.delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.employees.remove(auth, id);
  }

  @RequirePermission('employee.view')
  @Get(':id/activity')
  activity(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ListResponse<EmployeeActivityItem>> {
    return this.employees.activity(auth, id, query.page, query.limit);
  }
}

/** Self-service: every signed-in user with an employee record. */
@Controller('me/profile')
export class MyProfileController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  async get(@CurrentAuth() auth: AuthContext): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.myProfile(auth) };
  }

  @Patch()
  async update(@CurrentAuth() auth: AuthContext, @Body() body: UpdateMyProfileDto): Promise<DataResponse<EmployeeDetail>> {
    return { data: await this.employees.updateMyProfile(auth, body) };
  }
}
