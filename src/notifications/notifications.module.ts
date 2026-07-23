import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  NotificationsService,
  NOTIFICATIONS_QUEUE,
} from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
