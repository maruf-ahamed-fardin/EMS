import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  type DataResponse,
  type ListResponse,
  type OwnTeamProfile,
  type TeamProfileDetail,
  type TeamProfileFilters,
  type TeamProfileListItem,
  teamProfileQuery,
  updateOwnTeamProfileSchema,
} from '@ems/contracts';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, RequirePermission } from '../auth/decorators';
import { TeamProfileService } from './team-profile.service';

class TeamProfileQueryDto extends createZodDto(teamProfileQuery) {}
class UpdateOwnTeamProfileDto extends createZodDto(updateOwnTeamProfileSchema) {}

/**
 * The staff directory (Team Profile). Unlike `/employees`, the reach is not scoped: everyone who
 * holds `team_profile.view` sees everyone, which is the point of a directory. What keeps that safe
 * is the response shape — the service reads its own short column list, so no private employee
 * field can appear here even if one is added to the table later.
 */
@Controller('team-profile')
export class TeamProfileController {
  constructor(private readonly teamProfile: TeamProfileService) {}

  @RequirePermission('team_profile.view')
  @Get()
  async list(@Query() query: TeamProfileQueryDto): Promise<ListResponse<TeamProfileListItem>> {
    return this.teamProfile.list(query);
  }

  /** The departments and locations that actually have someone listed, for the filter menus. */
  @RequirePermission('team_profile.view')
  @Get('filters')
  async filters(): Promise<DataResponse<TeamProfileFilters>> {
    return { data: await this.teamProfile.filters() };
  }

  /** The viewer's own card, with the fields only they see. Declared before `:employeeId`. */
  @RequirePermission('team_profile.manage_own')
  @Get('me')
  async own(@CurrentAuth() auth: AuthContext): Promise<DataResponse<OwnTeamProfile>> {
    return { data: await this.teamProfile.own(auth) };
  }

  @RequirePermission('team_profile.manage_own')
  @Patch('me')
  async updateOwn(
    @CurrentAuth() auth: AuthContext,
    @Body() body: UpdateOwnTeamProfileDto,
  ): Promise<DataResponse<OwnTeamProfile>> {
    return { data: await this.teamProfile.updateOwn(auth, body) };
  }

  @RequirePermission('team_profile.view')
  @Get(':employeeId')
  async detail(
    @CurrentAuth() auth: AuthContext,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ): Promise<DataResponse<TeamProfileDetail>> {
    return { data: await this.teamProfile.detail(auth, employeeId) };
  }
}
