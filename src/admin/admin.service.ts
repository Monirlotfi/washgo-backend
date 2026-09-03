import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CarouselGateway } from '../carousel/carousel.gateway';
import { CreateCarouselDto } from '../carousel/dto/create-carousel.dto';
import { UpdateCarouselDto } from '../carousel/dto/update-carousel.dto';
import { WasherStatus } from '@prisma/client';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
    private readonly carouselGateway: CarouselGateway,
    private readonly cache: CacheService,
  ) {}

  /**
   * Liste tous les washers en attente de validation
   */
  async getPendingWashers(take = 50, skip = 0) {
    return this.prisma.washerProfile.findMany({
      where: { verificationStatus: 'PENDING' },
      take,
      skip,
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

    await Promise.all([
      this.cache.del(`user:${washer.user.id}`),
      this.notifications.enqueue({
        userId: washer.user.id,
        type: 'ACCOUNT_APPROVED',
        title: '✅ Compte activé !',
        body: `Bienvenue ${washer.user.fullName} ! Votre compte WashGo est maintenant actif. Vous pouvez commencer à accepter des commandes.`,
        data: { type: 'ACCOUNT_APPROVED' },
      }).catch((err) => {
        this.logger.error(`Échec de l'envoi de la notif ACCOUNT_APPROVED à ${washer.user.id}`, err as Error);
      }),
    ]);

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

    await Promise.all([
      this.cache.del(`user:${washer.user.id}`),
      this.notifications.enqueue({
        userId: washer.user.id,
        type: 'ACCOUNT_REJECTED',
        title: '❌ Demande refusée',
        body: `Votre demande n'a pas pu être validée. Motif : ${reason}`,
        data: { type: 'ACCOUNT_REJECTED' },
      }).catch((err) => {
        this.logger.error(`Échec de l'envoi de la notif ACCOUNT_REJECTED à ${washer.user.id}`, err as Error);
      }),
    ]);

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

    await Promise.all([
      this.cache.del(`user:${washer.user.id}`),
      this.notifications.enqueue({
        userId: washer.user.id,
        type: 'ACCOUNT_RETRY',
        title: '⚠️ Correction requise',
        body: message,
        data: { type: 'ACCOUNT_RETRY', message },
      }).catch((err) => {
        this.logger.error(`Échec de l'envoi de la notif ACCOUNT_RETRY à ${washer.user.id}`, err as Error);
      }),
    ]);

    return updated;
  }

  /**
   * Liste tous les washers (approuvés, rejetés, en attente)
   */
  async getAllWashers(status?: string, take = 50, skip = 0) {
    return this.prisma.washerProfile.findMany({
      where: status ? { verificationStatus: status as any } : undefined,
      take,
      skip,
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

  async getAllCarouselSlides() {
    return this.prisma.carouselSlide.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async createCarouselSlide(dto: CreateCarouselDto, imageBuffer: Buffer) {
    const imageUrl = await this.cloudinary.uploadBuffer(imageBuffer, 'washgo/carousel');
    const slide = await this.prisma.carouselSlide.create({
      data: { ...dto, imageUrl },
    });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }

  async updateCarouselSlide(id: string, dto: UpdateCarouselDto, imageBuffer?: Buffer) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    let imageUrl: string | undefined;
    if (imageBuffer) {
      imageUrl = await this.cloudinary.uploadBuffer(imageBuffer, 'washgo/carousel');
    }

    const slide = await this.prisma.carouselSlide.update({
      where: { id },
      data: imageUrl ? { ...dto, imageUrl } : dto,
    });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }

  async deleteCarouselSlide(id: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    const slide = await this.prisma.carouselSlide.delete({ where: { id } });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }
}