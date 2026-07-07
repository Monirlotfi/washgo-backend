import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WasherStatus } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateCarouselDto } from '../carousel/dto/create-carousel.dto';
import { UpdateCarouselDto } from '../carousel/dto/update-carousel.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

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
        status: WasherStatus.OFFLINE,
      },
    });

    this.notifications.enqueue({
      userId: washer.user.id,
      type: 'ACCOUNT_APPROVED' as any,
      title: 'Compte active !',
      body: `Bienvenue ${washer.user.fullName} ! Votre compte WashGo est maintenant actif. Vous pouvez commencer a accepter des commandes.`,
      data: { type: 'ACCOUNT_APPROVED' },
    }).catch((err: any) => console.error(err));

    return updated;
  }

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

    this.notifications.enqueue({
      userId: washer.user.id,
      type: 'ACCOUNT_REJECTED' as any,
      title: 'Demande refusee',
      body: `Votre demande n'a pas pu etre validee. Motif : ${reason}`,
      data: { type: 'ACCOUNT_REJECTED' },
    }).catch((err: any) => console.error(err));

    return updated;
  }

  async retryWasher(washerId: string, adminId: string, message: string) {
    const washer = await this.prisma.washerProfile.findUnique({
      where: { id: washerId },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!washer) throw new NotFoundException('Laveur introuvable');
    if (washer.verificationStatus === 'REJECTED') {
      throw new BadRequestException('Ce laveur est déjà rejete definitivement');
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
      title: 'Correction requise',
      body: message,
      data: { type: 'ACCOUNT_RETRY', message },
    }).catch(console.error);

    return updated;
  }

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

  async getAllCarouselSlides() {
    return this.prisma.carouselSlide.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async createCarouselSlide(dto: CreateCarouselDto, imageBuffer: Buffer) {
    const imageUrl = await this.cloudinary.uploadBuffer(imageBuffer, 'washgo/carousel');
    return this.prisma.carouselSlide.create({
      data: { ...dto, imageUrl },
    });
  }

  async updateCarouselSlide(id: string, dto: UpdateCarouselDto, imageBuffer?: Buffer) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    let imageUrl: string | undefined;
    if (imageBuffer) {
      imageUrl = await this.cloudinary.uploadBuffer(imageBuffer, 'washgo/carousel');
    }

    return this.prisma.carouselSlide.update({
      where: { id },
      data: imageUrl ? { ...dto, imageUrl } : dto,
    });
  }

  async deleteCarouselSlide(id: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    return this.prisma.carouselSlide.delete({ where: { id } });
  }
}
