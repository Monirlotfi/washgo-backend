import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import {
  BookingStatus,
  OfferStatus,
  WasherStatus,
} from '@prisma/client';
import { calculateEtaMinutes, haversineDistanceMeters } from '../bookings/eta';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationMessages } from '../notifications/notification.messages';
import { NotificationPayload } from '../notifications/notification.types';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Le laveur fait une offre sur un booking PENDING.
   * Le booking ne change PAS de statut. Il reste PENDING jusqu'à choix client.
   */
  async makeOffer(
    userId: string,
    bookingId: string,
    dto: CreateOfferDto,
  ) {
    const profile = await this.prisma.washerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new ForbiddenException('Profil laveur introuvable');
    }
    if (!profile.isVerified) {
      throw new ForbiddenException(
        'Vous devez être vérifié pour faire des offres',
      );
    }
    if (profile.status === WasherStatus.OFFLINE) {
      throw new BadRequestException(
        'Vous devez être en ligne pour faire une offre',
      );
    }
    if (!profile.currentLat || !profile.currentLng) {
      throw new BadRequestException(
        'Position GPS requise pour faire une offre',
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException("Cette course n'accepte plus d'offres");
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      throw new BadRequestException('Cette course a expiré');
    }

    const existing = await this.prisma.washerOffer.findUnique({
      where: {
        bookingId_washerId: {
          bookingId,
          washerId: profile.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Vous avez déjà fait une offre sur cette course',
      );
    }

    const distanceM = haversineDistanceMeters(
      profile.currentLat,
      profile.currentLng,
      booking.lat,
      booking.lng,
    );
    const etaMin = calculateEtaMinutes(distanceM);

    const offer = await this.prisma.washerOffer.create({
      data: {
        bookingId,
        washerId: profile.id,
        proposedPriceMAD: dto.proposedPriceMAD,
        estimatedEtaMin: etaMin,
      },
    });

    // Invalidate available bookings cache for this washer
    await this.cache.del(`available-bookings:${profile.id}`);

    // Notif au client : nouvelle offre reçue
    const [washer, bookingForNotif] = await Promise.all([
      this.prisma.washerProfile.findUnique({
        where: { id: profile.id },
        include: { user: { select: { fullName: true } } },
      }),
      this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true },
      }),
    ]);

    if (washer && bookingForNotif) {
      this.notifications
        .enqueue(
          NotificationMessages.offerReceived({
            userId: bookingForNotif.clientId,
            bookingId,
            offerId: offer.id,
            washerName: washer.user.fullName,
            proposedPriceMAD: offer.proposedPriceMAD,
            etaMin: offer.estimatedEtaMin,
          }),
        )
        .catch((err) => this.logger.error(`Échec de la notif OFFER_RECEIVED pour booking ${bookingId}`, err));
    }

    return offer;
  }

  /**
   * Le client choisit une offre. Le booking passe à ACCEPTED avec ce laveur.
   * Toutes les autres offres sont marquées REJECTED.
   * Le laveur sélectionné devient BUSY.
   */
  async chooseOffer(
    clientId: string,
    bookingId: string,
    offerId: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException("Cette réservation n'est plus en attente");
    }
    if (booking.expiresAt && booking.expiresAt < new Date()) {
      throw new BadRequestException('Délai expiré pour choisir un laveur');
    }

    const offer = await this.prisma.washerOffer.findUnique({
      where: { id: offerId },
      include: { washer: true },
    });
    if (!offer || offer.bookingId !== bookingId) {
      throw new NotFoundException('Offre introuvable');
    }
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException("Cette offre n'est plus disponible");
    }
    if (offer.washer.status !== WasherStatus.AVAILABLE) {
      throw new BadRequestException(
        "Ce laveur n'est plus disponible. Choisissez une autre offre.",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Accepter cette offre
      await tx.washerOffer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED },
      });

      // 2. Rejeter toutes les autres offres sur ce booking
      await tx.washerOffer.updateMany({
        where: {
          bookingId,
          id: { not: offerId },
          status: OfferStatus.PENDING,
        },
        data: { status: OfferStatus.REJECTED },
      });

      // 3. Mettre à jour le booking : ACCEPTED + washerId + prix final
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.ACCEPTED,
          washerId: offer.washerId,
          priceMAD: offer.proposedPriceMAD,
          estimatedDurationMin: offer.estimatedEtaMin,
          acceptedAt: new Date(),
        },
        include: {
          vehicle: true,
          washer: {
            select: {
              id: true,
              avgRating: true,
              user: { select: { fullName: true, phone: true } },
            },
          },
        },
      });

      // 4. Le laveur passe en BUSY
      await tx.washerProfile.update({
        where: { id: offer.washerId },
        data: { status: WasherStatus.BUSY },
      });

      return updatedBooking;
    });

    await this.cache.delPattern('available-bookings:*');

    // Notifs (hors transaction, fire-and-forget)
    const [client, chosenWasher, rejectedOffers] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: clientId },
        select: { fullName: true },
      }),
      this.prisma.washerProfile.findUnique({
        where: { id: offer.washerId },
        select: { userId: true },
      }),
      this.prisma.washerOffer.findMany({
        where: { bookingId, status: 'REJECTED' },
        include: {
          washer: { select: { userId: true } },
        },
      }),
    ]);

    const notifPayloads: NotificationPayload[] = [];

    if (client && chosenWasher) {
      notifPayloads.push(
        NotificationMessages.offerAccepted({
          userId: chosenWasher.userId,
          bookingId,
          clientName: client.fullName,
        }),
      );
    }

    for (const r of rejectedOffers) {
      notifPayloads.push(
        NotificationMessages.offerRejected({
          userId: r.washer.userId,
          bookingId,
        }),
      );
    }

    if (notifPayloads.length > 0) {
      this.notifications
        .enqueueMany(notifPayloads)
        .catch((err) => this.logger.error(`Échec des notifs OFFER_ACCEPTED/OFFER_REJECTED pour booking ${bookingId}`, err));
    }

    return updated;
  }

  /**
   * Le client liste les offres reçues sur son booking.
   */
  async listOffersForBooking(clientId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }

    return this.prisma.washerOffer.findMany({
      where: {
        bookingId,
        status: OfferStatus.PENDING,
      },
      include: {
        washer: {
          select: {
            id: true,
            avgRating: true,
            totalBookings: true,
            currentLat: true,
            currentLng: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { proposedPriceMAD: 'asc' },
    });
  }

  /**
   * Le laveur liste ses propres offres en cours (statut PENDING).
   */
  async listMyPendingOffers(userId: string) {
    const profile = await this.prisma.washerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil laveur introuvable');

    return this.prisma.washerOffer.findMany({
      where: {
        washerId: profile.id,
        status: OfferStatus.PENDING,
        booking: {
          status: BookingStatus.PENDING,
        },
      },
      include: {
        booking: {
          include: {
            client: { select: { fullName: true } },
            vehicle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tâche cron-like : on l'appellera périodiquement (ou à la demande).
   * Marque les offres et bookings expirés comme EXPIRED/CANCELLED.
   */
  async expireStaleBookings() {
    const now = new Date();

    const expired = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        expiresAt: { lt: now },
      },
      select: { id: true, clientId: true },
    });

    for (const b of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: b.id },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: 'Aucun laveur choisi dans le délai imparti',
            cancelledBy: 'SYSTEM',
          },
        });
        await tx.washerOffer.updateMany({
          where: { bookingId: b.id, status: OfferStatus.PENDING },
          data: { status: OfferStatus.EXPIRED },
        });
      });

      try {
        await this.notifications.enqueue(
          NotificationMessages.bookingExpired({ userId: b.clientId, bookingId: b.id }),
        );
      } catch (err) {
        this.logger.error(`Échec de la notif BOOKING_EXPIRED pour booking ${b.id}`, err as Error);
      }
    }

    if (expired.length > 0) {
      await this.cache.delPattern('available-bookings:*');
    }

    if (expired.length > 0) {
      await this.cache.delPattern('available-bookings:*');
    }

    return { expiredCount: expired.length };
  }
}