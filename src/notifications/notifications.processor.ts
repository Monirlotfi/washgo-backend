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

  async process(job: Job<NotificationPayload | { ticketId: string; userId: string }>): Promise<void> {
    if (job.name === 'checkReceipt') {
      const data = job.data as { ticketId: string; userId: string };
      this.logger.debug(`Checking receipt for ticket ${data.ticketId} → user ${data.userId}`);
      await this.notifications.checkReceipt(data);
      return;
    }

    const payload = job.data as NotificationPayload;
    this.logger.debug(
      `Processing notif ${job.id} (${payload.type}) → user ${payload.userId}`,
    );
    await this.notifications.sendNow(payload);
  }
}
