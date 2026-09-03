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
      include: { rating: true },
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
    if (booking.rating) {
      throw new ConflictException('Cette réservation a déjà été notée');
    }

    // Réservations sans laveur (anciennes/données de test) : on enregistre
    // simplement la note, sans recalcul de moyenne.
    if (!booking.washerId) {
      return this.prisma.rating.create({
        data: {
          bookingId,
          authorId: clientId,
          score: dto.score,
          comment: dto.comment,
        },
      });
    }

    // 2. Transaction : créer le rating + recalculer avgRating du laveur
    return this.prisma.$transaction(async (tx) => {
      const rating = await tx.rating.create({
        data: {
          bookingId,
          authorId: clientId,
          score: dto.score,
          comment: dto.comment,
        },
      });

      // Recalcule la moyenne sur tous les ratings du laveur
      const stats = await tx.rating.aggregate({
        where: {
          booking: {
            washerId: booking.washerId!,
          },
        },
        _avg: { score: true },
        _count: true,
      });

      await tx.washerProfile.update({
        where: { id: booking.washerId! },
        data: {
          avgRating: stats._avg.score ?? 0,
        },
      });

      return rating;
    });
  }

  /** Récupère le rating d'un booking (s'il existe) */
  async getByBooking(clientId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { rating: true },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    return booking.rating;
  }
}