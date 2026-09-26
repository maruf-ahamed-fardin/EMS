import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { changeUserRoleInput, createUserInput, type DataResponse, type ListResponse, type UserFormOptions, type UserListItem, userListQuery } from '@/lib/validations';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '@/lib/auth/auth-context';
import { CurrentAuth, RequirePermission } from '@/lib/auth/decorators';
import { UsersService } from './users.service';

class UserListQueryDto extends createZodDto(userListQuery) {}
class CreateUserDto extends createZodDto(createUserInput) {}
class ChangeUserRoleDto extends createZodDto(changeUserRoleInput) {}

/** Sign-in accounts. Seeing them needs `user.view`; every change needs `user.manage` (Super Admin by default). */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermission('user.view')
  @Get()
  list(@CurrentAuth() auth: AuthContext, @Query() query: UserListQueryDto): Promise<ListResponse<UserListItem>> {
    return this.users.list(auth, query);
  }

  @RequirePermission('user.manage')
  @Get('form-options')
  async options(@CurrentAuth() auth: AuthContext): Promise<DataResponse<UserFormOptions>> {
    return { data: await this.users.options(auth) };
  }

  @RequirePermission('user.manage')
  @Post()
  async create(@CurrentAuth() auth: AuthContext, @Body() body: CreateUserDto): Promise<DataResponse<UserListItem>> {
    return { data: await this.users.create(auth, body) };
  }

  @RequirePermission('user.manage')
  @Patch(':id/role')
  async changeRole(@CurrentAuth() auth: AuthContext, @Param('id') id: string, @Body() body: ChangeUserRoleDto): Promise<DataResponse<UserListItem>> {
    return { data: await this.users.changeRole(auth, id, body.roleId) };
  }

  @RequirePermission('user.manage')
  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<UserListItem>> {
    return { data: await this.users.deactivate(auth, id) };
  }

  @RequirePermission('user.manage')
  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<UserListItem>> {
    return { data: await this.users.activate(auth, id) };
  }

  @RequirePermission('user.manage')
  @Post(':id/send-reset')
  @HttpCode(HttpStatus.OK)
  async sendReset(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<UserListItem>> {
    return { data: await this.users.sendReset(auth, id) };
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
