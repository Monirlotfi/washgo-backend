import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NotificationsService,
  NOTIFICATIONS_QUEUE,
} from './notifications.service';
import { NotificationPayload } from './notification.types';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationPayload>): Promise<void> {
    this.logger.debug(
      `Processing notif ${job.id} (${job.data.type}) → user ${job.data.userId}`,
    );
    await this.notifications.sendNow(job.data);
  }
}
