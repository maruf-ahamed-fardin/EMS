import { Module } from '@nestjs/common';
import { EmployeesController, MyProfileController } from './employees.controller';
import { EmployeesService } from './employees.service';

@Module({
  controllers: [EmployeesController, MyProfileController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
