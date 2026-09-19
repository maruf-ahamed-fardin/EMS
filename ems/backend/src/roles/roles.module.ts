import { Module } from '@nestjs/common';
import { RolesController, RolesService } from './roles.controller';

@Module({ controllers: [RolesController], providers: [RolesService] })
export class RolesModule {}
