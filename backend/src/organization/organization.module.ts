import { Module } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { DepartmentsController, PositionsController } from './organization.controller';
import { PositionsService } from './positions.service';

@Module({
  controllers: [DepartmentsController, PositionsController],
  providers: [DepartmentsService, PositionsService],
})
export class OrganizationModule {}
