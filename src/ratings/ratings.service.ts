import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le client note le laveur après un booking COMPLETED.
   * Recalcule automatiquement avgRating du laveur.
   */
  async rateBooking(
    clientId: string,
    bookingId: string,
    dto: CreateRatingDto,
  ) {
    // 1. Charger le booking et vérifier les conditions
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, clientId: true, status: true, washerId: true,
        rating: { select: { id: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException('Réservation introuvable');
    }
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'Seuls les lavages terminés peuvent être notés',
      );
    }
    if (!booking.washerId) {
      throw new BadRequestException('Aucun laveur associé à cette réservation');
    }
    if (booking.rating) {
      throw new ConflictException('Cette réservation a déjà été notée');
    }

    // 2. Transaction : créer le rating + mettre à jour avgRating de façon incrémentale
    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          bookingId,
          authorId: clientId,
          score: dto.score,
          comment: dto.comment,
        },
      });

      // Mise à jour incrémentale : newAvg = (oldAvg * oldCount + newScore) / (oldCount + 1)
      // Évite un O(n) aggregate sur tous les ratings à chaque nouvelle note
      const profile = await tx.washerProfile.findUnique({
        where: { id: booking.washerId! },
        select: { avgRating: true, totalBookings: true },
      });

      const oldCount = (profile?.totalBookings ?? 0);
      const oldAvg = profile?.avgRating ?? 0;
      const newAvg = oldCount > 0
        ? Math.round(((oldAvg * oldCount + dto.score) / (oldCount + 1)) * 10) / 10
        : dto.score;

      await tx.washerProfile.update({
        where: { id: booking.washerId! },
        data: {
          avgRating: newAvg,
        },
      });

      return rating;
    });
  }

  /** Récupère le rating d'un booking (s'il existe) */
  async getByBooking(clientId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true, clientId: true,
        rating: { select: { id: true, score: true, comment: true, createdAt: true, authorId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    return booking.rating;
  }
}