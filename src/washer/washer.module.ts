import { Module } from '@nestjs/common';
import { WasherService } from './washer.service';
import { WasherController } from './washer.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WasherController],
  providers: [WasherService],
})
export class WasherModule {}