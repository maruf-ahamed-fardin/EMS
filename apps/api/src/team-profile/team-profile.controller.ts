import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  type DataResponse,
  type OwnTeamProfile,
  PHOTO_FIELD,
  PHOTO_MAX_BYTES,
  type TeamProfileDetail,
  type TeamProfileFilters,
  type TeamProfileListResponse,
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
 * The staff directory (Team Profile). `team_profile.view` lets someone look a colleague up and
 * open their card; `team_profile.browse` lets them page through everyone (see the service). What
 * keeps a card safe is its shape — the service reads its own short column list, so no private
 * employee field can appear here even if one is added to the table later.
 */
@Controller('team-profile')
export class TeamProfileController {
  constructor(private readonly teamProfile: TeamProfileService) {}

  @RequirePermission('team_profile.view')
  @Get()
  async list(@CurrentAuth() auth: AuthContext, @Query() query: TeamProfileQueryDto): Promise<TeamProfileListResponse> {
    return this.teamProfile.list(auth, query);
  }

  /** The departments and locations that actually have someone listed, for the filter menus. */
  @RequirePermission('team_profile.browse')
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

  /**
   * Replaces the viewer's own photo. The browser crops it to a small square first, so the 2 MB
   * limit is generous; multer stops reading past it. The type is checked from the bytes.
   */
  @RequirePermission('team_profile.manage_own')
  @Post('me/photo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor(PHOTO_FIELD, { limits: { fileSize: PHOTO_MAX_BYTES, files: 1, fields: 0 } }))
  async setPhoto(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ): Promise<DataResponse<OwnTeamProfile>> {
    return { data: await this.teamProfile.setPhoto(auth, file) };
  }

  @RequirePermission('team_profile.manage_own')
  @Delete('me/photo')
  async removePhoto(@CurrentAuth() auth: AuthContext): Promise<DataResponse<OwnTeamProfile>> {
    return { data: await this.teamProfile.removePhoto(auth) };
  }

  /**
   * A card's photo, for `<img>`. The URL carries a version that changes with every new photo, so
   * it can be cached for good — privately, since it is only for signed-in colleagues. Served as an
   * inline image that can never run as a page on this origin.
   */
  @RequirePermission('team_profile.view')
  @Get(':employeeId/photo')
  async photo(@Param('employeeId', ParseUUIDPipe) employeeId: string, @Res() res: Response): Promise<void> {
    const { bytes, contentType } = await this.teamProfile.photo(employeeId);
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res.end(bytes);
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
