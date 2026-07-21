import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BookingStatus,
  CancellationActor,
  WasherStatus,
  WashType,
} from '@prisma/client';
import { CancelBookingDto, CancellationReason } from './dto/cancel-booking.dto';
import { getAllPricesForVehicle, getPriceForBooking } from './pricing';
import { calculateEtaMinutes, haversineDistanceMeters } from './eta';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationMessages } from '../notifications/notification.messages';

const SEARCH_RADIUS_METERS = 5000;
const MAX_WASHERS_TO_RETURN = 5;

export interface NearbyWasher {
  washer_id: string;
  user_id: string;
  full_name: string;
  avg_rating: number;
  distance_meters: number;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(clientId: string, dto: CreateBookingDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable');
    }
    if (vehicle.userId !== clientId) {
      throw new ForbiddenException('Ce véhicule ne vous appartient pas');
    }

    const activeBooking = await this.prisma.booking.findFirst({
      where: {
        clientId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.ACCEPTED,
            BookingStatus.ARRIVED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.AWAITING_CLIENT_CONFIRMATION,
          ],
        },
      },
    });
    if (activeBooking) {
      throw new BadRequestException(
        "Vous avez déjà une réservation en cours. Annulez-la ou attendez qu'elle se termine.",
      );
    }

    const washType = dto.washType ?? WashType.BASIC;
    const priceMAD = getPriceForBooking(vehicle, washType);

    const scheduledAt = dto.scheduledAt
      ? new Date(dto.scheduledAt)
      : new Date();

    const EXPIRY_MINUTES = process.env.NODE_ENV === 'production' ? 5 : 30;
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

    const booking = await this.prisma.booking.create({
      data: {
        clientId,
        vehicleId: dto.vehicleId,
        addressLabel: dto.addressLabel,
        lat: dto.lat,
        lng: dto.lng,
        scheduledAt,
        priceMAD,
        notes: dto.notes,
        washType,
        estimatedDurationMin: null,
        status: BookingStatus.PENDING,
        expiresAt,
      },
      include: {
        vehicle: true,
      },
    });

    this.notifyNearbyWashers(booking.id, dto.lat, dto.lng).catch((err) => {
      this.logger.error(`Échec de notification des laveurs proches pour booking ${booking.id}`, err);
    });

    return {
      booking,
      suggestedPrice: priceMAD,
      expiresAt,
    };
  }

  async findByClient(clientId: string) {
    return this.prisma.booking.findMany({
      where: { clientId },
      include: {
        vehicle: { select: { brand: true, model: true, plate: true, size: true, category: true } },
        washer: {
          select: {
            id: true,
            avgRating: true,
            totalBookings: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForClient(clientId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: true,
        washer: {
          select: {
            id: true,
            avgRating: true,
            totalBookings: true,
            currentLat: true,
            currentLng: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        rating: true,
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('Cette réservation ne vous appartient pas');
    }
    return booking;
  }

  async getPricesForVehicle(clientId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) throw new NotFoundException('Véhicule introuvable');
    if (vehicle.userId !== clientId) {
      throw new ForbiddenException('Ce véhicule ne vous appartient pas');
    }
    return getAllPricesForVehicle(vehicle);
  }

  private async findNearbyWashers(
    lat: number,
    lng: number,
  ): Promise<NearbyWasher[]> {
    const washers = await this.prisma.$queryRaw<NearbyWasher[]>`
      SELECT
        wp.id AS washer_id,
        u.id AS user_id,
        u."fullName" AS full_name,
        wp."avgRating" AS avg_rating,
        ST_DistanceSphere(
          ST_MakePoint(wp."currentLng", wp."currentLat"),
          ST_MakePoint(${lng}, ${lat})
        ) AS distance_meters
      FROM "WasherProfile" wp
      INNER JOIN "User" u ON u.id = wp."userId"
      WHERE wp.status = 'AVAILABLE'
        AND wp."currentLat" IS NOT NULL
        AND wp."currentLng" IS NOT NULL
        AND wp."isVerified" = true
        AND ST_DistanceSphere(
          ST_MakePoint(wp."currentLng", wp."currentLat"),
          ST_MakePoint(${lng}, ${lat})
        ) <= ${SEARCH_RADIUS_METERS}
      ORDER BY distance_meters ASC
      LIMIT ${MAX_WASHERS_TO_RETURN}
    `;

    return washers.map((w) => ({
      ...w,
      distance_meters: Math.round(Number(w.distance_meters)),
      avg_rating: Number(w.avg_rating),
    }));
  }

  async cancelByClient(
    clientId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.findOneForClient(clientId, bookingId);

    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        'Cette réservation ne peut plus être annulée à ce stade',
      );
    }

    const reasonLabel = this.formatReason(dto.reason, dto.customReason);
    const washerIdToNotify = booking.washerId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancellationReason: reasonLabel,
          cancelledBy: CancellationActor.CLIENT,
        },
      });

      if (booking.washerId) {
        await tx.washerProfile.update({
          where: { id: booking.washerId },
          data: { status: 'AVAILABLE' },
        });
      }

      return updatedBooking;
    });

    if (washerIdToNotify) {
      const washer = await this.prisma.washerProfile.findUnique({
        where: { id: washerIdToNotify },
        select: { userId: true },
      });
      if (washer) {
        try {
          await this.notifications.enqueue(
            NotificationMessages.bookingCancelledByClient({
              userId: washer.userId,
              bookingId,
              reason: reasonLabel,
            }),
          );
        } catch (err) {
          this.logger.error(`Échec de la notif BOOKING_CANCELLED_BY_CLIENT pour booking ${bookingId}`, err as Error);
        }
      }
    }

    return updated;
  }

  async confirmCompletion(clientId: string, bookingId: string) {
    const booking = await this.findOneForClient(clientId, bookingId);

    if (booking.status !== BookingStatus.AWAITING_CLIENT_CONFIRMATION) {
      throw new BadRequestException(
        "Ce lavage n'est pas en attente de votre confirmation",
      );
    }

    if (!booking.washerId) {
      throw new BadRequestException('Aucun laveur associé à cette réservation');
    }

    const washerId = booking.washerId;
    const priceMAD = booking.priceMAD;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.COMPLETED },
      });

      await tx.washerProfile.update({
        where: { id: washerId },
        data: {
          status: WasherStatus.AVAILABLE,
          totalBookings: { increment: 1 },
        },
      });

      return updatedBooking;
    });

    const [client, washer] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: clientId } }),
      this.prisma.washerProfile.findUnique({
        where: { id: washerId },
        include: { user: true },
      }),
    ]);

    if (client && washer) {
      try {
        await this.notifications.enqueue(
          NotificationMessages.bookingConfirmedByClient({
            userId: washer.userId,
            bookingId,
            clientName: client.fullName,
            priceMAD,
          }),
        );
      } catch (err) {
        this.logger.error(`Échec de la notif BOOKING_CONFIRMED_BY_CLIENT pour booking ${bookingId}`, err as Error);
      }
    }

    return updated;
  }

  async findActiveForClient(clientId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        clientId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.ACCEPTED,
            BookingStatus.ARRIVED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.AWAITING_CLIENT_CONFIRMATION,
          ],
        },
      },
      include: {
        vehicle: { select: { brand: true, model: true, plate: true, size: true, category: true } },
        washer: {
          select: {
            id: true,
            avgRating: true,
            currentLat: true,
            currentLng: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return booking ?? null;
  }

  async getHistoryForClient(clientId: string) {
    return this.prisma.booking.findMany({
      where: {
        clientId,
        status: { in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
      },
      include: {
        vehicle: { select: { brand: true, model: true, plate: true, size: true, category: true } },
        washer: {
          select: {
            avgRating: true,
            user: { select: { fullName: true, phone: true } },
          },
        },
        rating: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async notifyNearbyWashers(
    bookingId: string,
    lat: number,
    lng: number,
  ) {
    const nearbyWashers = await this.prisma.$queryRaw<
      Array<{ user_id: string; full_name: string; distance: number }>
    >`
      SELECT
        u.id AS user_id,
        u."fullName" AS full_name,
        ST_DistanceSphere(
          ST_MakePoint(${lng}, ${lat}),
          ST_MakePoint(wp."currentLng", wp."currentLat")
        ) AS distance
      FROM "WasherProfile" wp
      INNER JOIN "User" u ON u.id = wp."userId"
      WHERE wp.status = 'AVAILABLE'
        AND wp."currentLat" IS NOT NULL
        AND wp."currentLng" IS NOT NULL
        AND wp."isVerified" = true
        AND ST_DistanceSphere(
          ST_MakePoint(${lng}, ${lat}),
          ST_MakePoint(wp."currentLng", wp."currentLat")
        ) <= ${SEARCH_RADIUS_METERS}
      ORDER BY distance ASC
    `;

    if (nearbyWashers.length === 0) return;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        vehicle: { select: { brand: true, model: true } },
      },
    });
    if (!booking) return;

    const washTypeLabel =
      (
        {
          BASIC: '💧 Basique',
          PREMIUM: '✨ Premium',
          VIP: '👑 VIP',
        } as Record<string, string>
      )[booking.washType] ?? booking.washType;

    const vehicleLabel = `${booking.vehicle.brand} ${booking.vehicle.model}`;

    const payloads = nearbyWashers.map((w) =>
      NotificationMessages.newBookingNearby({
        userId: w.user_id,
        bookingId,
        distanceKm: Number(w.distance) / 1000,
        suggestedPriceMAD: booking.priceMAD,
        washTypeLabel,
        vehicleLabel,
      }),
    );

    await this.notifications.enqueueMany(payloads);
  }

  private formatReason(
    reason: CancellationReason,
    customReason?: string,
  ): string {
    const labels: Record<CancellationReason, string> = {
      CONFLICT_WITH_WASHER: 'Conflit avec le laveur',
      WASHER_LATE: 'Le laveur a tardé',
      CHANGED_MIND: "J'ai changé d'avis",
      OTHER: customReason?.trim() || 'Autre',
    };
    return labels[reason];
  }
}