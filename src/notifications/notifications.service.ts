import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
} from 'expo-server-sdk';
import { NotificationPayload } from './notification.types';

export const NOTIFICATIONS_QUEUE = 'notifications';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private expo: Expo;

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
    });
  }

  /**
   * Met une notification en queue (point d'entrée principal).
   * Appel non-bloquant.
   */
  async enqueue(payload: NotificationPayload) {
    await this.queue.add('send', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }

  /**
   * Met N notifications en queue d'un coup (broadcast).
   */
  async enqueueMany(payloads: NotificationPayload[]) {
    if (payloads.length === 0) return;
    await this.queue.addBulk(
      payloads.map((p) => ({
        name: 'send',
        data: p,
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      })),
    );
  }

  /**
   * Envoie effectivement la notification via Expo Push API.
   * Appelé par le processor BullMQ.
   */
  async sendNow(payload: NotificationPayload): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { pushToken: true, fullName: true },
    });

    if (!user?.pushToken) {
      this.logger.warn(
        `Pas de pushToken pour user ${payload.userId} (${user?.fullName ?? 'inconnu'})`,
      );
      return;
    }

    if (!Expo.isExpoPushToken(user.pushToken)) {
      this.logger.error(`Token invalide : ${user.pushToken}`);
      await this.prisma.user.update({
        where: { id: payload.userId },
        data: { pushToken: null },
      });
      return;
    }

    const message: ExpoPushMessage = {
      to: user.pushToken,
      title: payload.title,
      body: payload.body,
      data: { type: payload.type, ...(payload.data ?? {}) },
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    };

    try {
      const tickets: ExpoPushTicket[] = await this.expo.sendPushNotificationsAsync([message]);
      const ticket = tickets[0];

      if (ticket.status === 'error') {
        this.logger.error(`Erreur Expo : ${ticket.message}`);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await this.prisma.user.update({
            where: { id: payload.userId },
            data: { pushToken: null },
          });
        }
      } else {
        this.logger.log(
          `Notif envoyée à ${user.fullName ?? payload.userId} : ${payload.title}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Erreur réseau Expo : ${err.message}`);
      throw err;
    }
  }
}
