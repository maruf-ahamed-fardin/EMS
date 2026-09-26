import { Module } from '@nestjs/common';
import { DocumentsModule } from '@/lib/services/documents/documents.controller';
import { TeamProfileController } from './team-profile.controller';
import { TeamProfileService } from './team-profile.service';

@Module({
  // For the storage the card photos share with documents (keys never leave the server either way)
  imports: [DocumentsModule],
  controllers: [TeamProfileController],
  providers: [TeamProfileService],
})
export class TeamProfileModule {}
