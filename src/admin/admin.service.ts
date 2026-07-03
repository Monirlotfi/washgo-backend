import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WasherStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Liste tous les washers en attente de validation
   */
  async getPendingWashers() {
    return this.prisma.washerProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true, createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Détail d'un washer (pour voir sa photo CIN)
   */
  async getWasherDetail(washerId: string) {
    const washer = await this.prisma.washerProfile.findUnique({
      where: { id: washerId },
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true,
            email: true, createdAt: true, pushToken: true,
          },
        },
      },
    });

    if (!washer) throw new NotFoundException('Laveur introuvable');
    return washer;
  }

  /**
   * Approuve un washer → isVerified = true + notif push
   */
  async approveWasher(washerId: string, adminId: string) {
    const washer = await this.prisma.washerProfile.findUnique({
      where: { id: washerId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!washer) throw new NotFoundException('Laveur introuvable');
    if (washer.verificationStatus === 'APPROVED') {
      throw new BadRequestException('Ce laveur est déjà approuvé');
    }

    const updated = await this.prisma.washerProfile.update({
      where: { id: washerId },
      data: {
        isVerified: true,
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
        verifiedBy: adminId,
        status: WasherStatus.OFFLINE, // peut maintenant se connecter
      },
    });

    // Notif push au washer
    this.notifications.enqueue({
      userId: washer.user.id,
      type: 'ACCOUNT_APPROVED' as any,
      title: '✅ Compte activé !',
      body: `Bienvenue ${washer.user.fullName} ! Votre compte WashGo est maintenant actif. Vous pouvez commencer à accepter des commandes.`,
      data: { type: 'ACCOUNT_APPROVED' },
    }).catch(console.error);

    return updated;
  }

  /**
   * Rejette un washer → notif push avec motif
   */
  async rejectWasher(washerId: string, adminId: string, reason: string) {
    const washer = await this.prisma.washerProfile.findUnique({
      where: { id: washerId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!washer) throw new NotFoundException('Laveur introuvable');
    if (washer.verificationStatus === 'REJECTED') {
      throw new BadRequestException('Ce laveur est déjà rejeté');
    }

    const updated = await this.prisma.washerProfile.update({
      where: { id: washerId },
      data: {
        isVerified: false,
        verificationStatus: 'REJECTED',
        verificationNote: reason,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      },
    });

    // Notif push au washer
    this.notifications.enqueue({
      userId: washer.user.id,
      type: 'ACCOUNT_REJECTED' as any,
      title: '❌ Demande refusée',
      body: `Votre demande n'a pas pu être validée. Motif : ${reason}`,
      data: { type: 'ACCOUNT_REJECTED' },
    }).catch(console.error);

    return updated;
  }

  /**
   * Demande une correction au washer → statut RETRY + notif push
   */
  async retryWasher(washerId: string, adminId: string, message: string) {
    const washer = await this.prisma.washerProfile.findUnique({
      where: { id: washerId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!washer) throw new NotFoundException('Laveur introuvable');
    if (washer.verificationStatus === 'REJECTED') {
      throw new BadRequestException('Ce laveur est déjà rejeté définitivement');
    }

    const updated = await this.prisma.washerProfile.update({
      where: { id: washerId },
      data: {
        isVerified: false,
        verificationStatus: 'RETRY',
        verificationNote: message,
        retryMessage: message,
      },
    });

    this.notifications.enqueue({
      userId: washer.user.id,
      type: 'ACCOUNT_RETRY' as any,
      title: '⚠️ Correction requise',
      body: message,
      data: { type: 'ACCOUNT_RETRY', message },
    }).catch(console.error);

    return updated;
  }

  /**
   * Liste tous les washers (approuvés, rejetés, en attente)
   */
  async getAllWashers(status?: string) {
    return this.prisma.washerProfile.findMany({
      where: status ? { verificationStatus: status as any } : undefined,
      include: {
        user: {
          select: {
            id: true, fullName: true, phone: true, createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}