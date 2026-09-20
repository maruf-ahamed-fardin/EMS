import { Module } from '@nestjs/common';
import { TeamProfileController } from './team-profile.controller';
import { TeamProfileService } from './team-profile.service';

@Module({
  controllers: [TeamProfileController],
  providers: [TeamProfileService],
})
export class TeamProfileModule {}
