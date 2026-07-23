import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { BookingStatus, CancellationActor, WasherStatus } from '@prisma/client';
import { WasherCancelBookingDto } from './dto/washer-cancel-booking.dto';
import { WasherCancellationReason } from '@prisma/client';
import { calculateEtaMinutes, haversineDistanceMeters } from '../bookings/eta';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationMessages } from '../notifications/notification.messages';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CacheService } from '../cache/cache.service';
import { GoOnlineDto } from './dto/go-online.dto';

const SEARCH_RADIUS_METERS = 5000;
const AVAILABLE_BOOKINGS_CACHE_TTL = 15_000;

export interface AvailableBooking {
  booking_id: string;
  client_name: string;
  client_phone: string;
  address_label: string;
  lat: number;
  lng: number;
  scheduled_at: Date;
  price_mad: number;
  notes: string | null;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_size: string;
  vehicle_category: string | null;
  wash_type: string;
  expires_at: Date | null;
  distance_meters: number;
}

@Injectable()
export class WasherService {
  private readonly logger = new Logger(WasherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly cloudinary: CloudinaryService,
    private readonly cache: CacheService,
  ) {}

  /** Récupère le WasherProfile associé à un userId */
  private async getProfileByUserId(userId: string) {
    const profile = await this.prisma.washerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Profil laveur introuvable');
    }
    return profile;
  }

  /**
   * Passage en ligne : un seul aller-retour, une seule écriture DB
   * (statut + position + timestamp), pas de vérification de booking actif.
   */
  async goOnline(userId: string, dto: GoOnlineDto) {
    const profile = await this.getProfileByUserId(userId);

    if (!profile.isVerified) {
      throw new ForbiddenException(
        'Votre profil doit être vérifié avant de pouvoir prendre des commandes',
      );
    }
    if (profile.status === WasherStatus.BUSY) {
      throw new BadRequestException(
        'Vous ne pouvez pas changer de statut pendant une réservation en cours',
      );
    }

    return this.prisma.washerProfile.update({
      where: { id: profile.id },
      data: {
        status: WasherStatus.AVAILABLE,
        currentLat: dto.lat,
        currentLng: dto.lng,
        lastLocationAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        currentLat: true,
        currentLng: true,
      },
    });
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const profile = await this.getProfileByUserId(userId);

    const updatedProfile = await this.prisma.washerProfile.update({
      where: { id: profile.id },
      data: {
        currentLat: dto.lat,
        currentLng: dto.lng,
        lastLocationAt: new Date(),
      },
      select: {
        id: true,
        currentLat: true,
        currentLng: true,
        lastLocationAt: true,
        status: true,
      },
    });

    // Si le laveur a un booking ACCEPTED, on recalcule l'ETA
    const activeAccepted = await this.prisma.booking.findFirst({
      where: {
        washerId: profile.id,
        status: BookingStatus.ACCEPTED,
      },
    });

    if (activeAccepted) {
      const distanceM = haversineDistanceMeters(
        dto.lat,
        dto.lng,
        activeAccepted.lat,
        activeAccepted.lng,
      );
      const eta = calculateEtaMinutes(distanceM);
      await this.prisma.booking.update({
        where: { id: activeAccepted.id },
        data: { estimatedDurationMin: eta },
      });
    }

    return updatedProfile;
  }

  async updateAvailability(userId: string, dto: UpdateAvailabilityDto) {
    const profile = await this.getProfileByUserId(userId);

    if (!profile.isVerified) {
      throw new ForbiddenException(
        'Votre profil doit être vérifié avant de pouvoir prendre des commandes',
      );
    }

    if (dto.status === WasherStatus.OFFLINE && profile.status === WasherStatus.BUSY) {
      throw new BadRequestException(
        'Vous ne pouvez pas vous déconnecter pendant une réservation en cours',
      );
    }

    return this.prisma.washerProfile.update({
      where: { id: profile.id },
      data: {
        status: dto.status,
        ...(dto.lat !== undefined && dto.lng !== undefined
          ? { currentLat: dto.lat, currentLng: dto.lng, lastLocationAt: new Date() }
          : {}),
      },
      select: {
        id: true,
        status: true,
        currentLat: true,
        currentLng: true,
      },
    });
  }

  async getAvailableBookings(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    if (!profile.currentLat || !profile.currentLng) {
      throw new BadRequestException('Position GPS requise');
    }

    const cacheKey = `available-bookings:${profile.id}`;
    const cached = await this.cache.get<AvailableBooking[]>(cacheKey);
    if (cached) return cached;

    const bookings = await this.prisma.$queryRaw<AvailableBooking[]>`
      SELECT
        b.id AS booking_id,
        u."fullName" AS client_name,
        u.phone AS client_phone,
        b."addressLabel" AS address_label,
        b.lat AS lat,
        b.lng AS lng,
        b."scheduledAt" AS scheduled_at,
        b."priceMAD" AS price_mad,
        b.notes AS notes,
        v.brand AS vehicle_brand,
        v.model AS vehicle_model,
        v.size AS vehicle_size,
        v.category AS vehicle_category,
        b."washType" AS wash_type,
        b."expiresAt" AS expires_at,
        ST_DistanceSphere(
          ST_MakePoint(b.lng, b.lat),
          ST_MakePoint(${profile.currentLng}, ${profile.currentLat})
        ) AS distance_meters
      FROM "Booking" b
      INNER JOIN "User" u ON u.id = b."clientId"
      INNER JOIN "Vehicle" v ON v.id = b."vehicleId"
      WHERE b.status = 'PENDING'
        AND (b."expiresAt" IS NULL OR b."expiresAt" > NOW())
        AND ST_DistanceSphere(
          ST_MakePoint(b.lng, b.lat),
          ST_MakePoint(${profile.currentLng}, ${profile.currentLat})
        ) <= ${SEARCH_RADIUS_METERS}
        AND NOT EXISTS (
          SELECT 1 FROM "WasherOffer" o
          WHERE o."bookingId" = b.id
            AND o."washerId" = ${profile.id}
        )
      ORDER BY distance_meters ASC
      LIMIT 20
    `;

    await this.cache.set(cacheKey, bookings, AVAILABLE_BOOKINGS_CACHE_TTL);
    return bookings;
  }

  async invalidateAvailableBookingsCache() {
    await this.cache.delPattern('available-bookings:*');
  }

  async acceptBooking(userId: string, bookingId: string) {
    throw new BadRequestException(
      'Acceptation directe désactivée. Utilisez "Faire une offre" à la place.',
    );
  }

  async markArrived(userId: string, bookingId: string) {
    const profile = await this.getProfileByUserId(userId);
    const updated = await this.transitionStatusInternal(
      profile.id,
      bookingId,
      BookingStatus.ACCEPTED,
      BookingStatus.ARRIVED,
      { arrivedAt: new Date() },
    );

    // Notif au client
    this.notifyClient(bookingId, profile.id, 'arrived').catch((err) =>
      this.logger.error(`Échec de la notif WASHER_ARRIVED pour booking ${bookingId}`, err),
    );

    return updated;
  }

  async startWash(userId: string, bookingId: string) {
    const profile = await this.getProfileByUserId(userId);
    const updated = await this.transitionStatusInternal(
      profile.id,
      bookingId,
      BookingStatus.ARRIVED,
      BookingStatus.IN_PROGRESS,
      { startedAt: new Date() },
    );

    this.notifyClient(bookingId, profile.id, 'started').catch((err) =>
      this.logger.error(`Échec de la notif WASH_STARTED pour booking ${bookingId}`, err),
    );

    return updated;
  }

  async completeWash(userId: string, bookingId: string) {
    const profile = await this.getProfileByUserId(userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking) throw new NotFoundException('Réservation introuvable');
      if (booking.washerId !== profile.id) {
        throw new ForbiddenException("Cette réservation n'est pas la vôtre");
      }
      if (booking.status !== BookingStatus.IN_PROGRESS) {
        throw new BadRequestException(
          'Le lavage doit être en cours pour être terminé',
        );
      }

      // Le laveur termine, mais on attend la confirmation du client.
      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.AWAITING_CLIENT_CONFIRMATION,
          completedAt: new Date(),
        },
      });
    });

    // Notif au client : "lavage terminé, confirmez svp"
    this.notifyClient(bookingId, profile.id, 'completed').catch((err) =>
      this.logger.error(`Échec de la notif WASH_COMPLETED_BY_WASHER pour booking ${bookingId}`, err),
    );

    return updated;
  }

  async getMyBookings(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    return this.prisma.booking.findMany({
      where: { washerId: profile.id },
      include: {
        client: {
          select: { fullName: true, phone: true },
        },
        vehicle: {
          select: { brand: true, model: true, plate: true, size: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Annulation par le laveur (force majeure, panne, etc.).
   * Le booking est ROUVERT en PENDING (pas annulé), pour qu'un autre laveur le prenne.
   * Le laveur est libéré.
   */
  async cancelByWasher(
    userId: string,
    bookingId: string,
    dto: WasherCancelBookingDto,
  ) {
    const profile = await this.getProfileByUserId(userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
      });
      if (!booking) throw new NotFoundException('Réservation introuvable');
      if (booking.washerId !== profile.id) {
        throw new ForbiddenException("Cette réservation n'est pas la vôtre");
      }
      if (booking.status !== BookingStatus.ACCEPTED) {
        throw new BadRequestException(
          "Vous ne pouvez plus annuler à ce stade. Contactez le client directement.",
        );
      }

      const reasonLabel = this.formatWasherReason(dto.reason, dto.customReason);

      const EXPIRY_MINUTES = process.env.NODE_ENV === 'production' ? 5 : 30;
      const newExpiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.PENDING,
          washerId: null,
          acceptedAt: null,
          washerCancelReason: dto.reason,
          cancellationReason: reasonLabel,
          cancelledBy: CancellationActor.WASHER,
          reopenedAt: new Date(),
          expiresAt: newExpiresAt,
        },
      });

      await tx.washerOffer.deleteMany({
        where: { bookingId },
      });

      await tx.washerProfile.update({
        where: { id: profile.id },
        data: { status: WasherStatus.AVAILABLE },
      });

      return { booking: updated, reasonLabel, clientId: booking.clientId };
    });

    await this.cache.delPattern('available-bookings:*');

    // Notif au client : "votre laveur a annulé"
    this.notifications
      .enqueue(
        NotificationMessages.bookingCancelledByWasher({
          userId: result.clientId,
          bookingId,
          reason: result.reasonLabel,
        }),
      )
      .catch((err) => this.logger.error(`Échec de la notif BOOKING_CANCELLED_BY_WASHER pour booking ${bookingId}`, err));

    await this.cache.delPattern('available-bookings:*');
    return result.booking;
  }

  private formatWasherReason(
    reason: WasherCancellationReason,
    customReason?: string,
  ): string {
    const labels: Record<WasherCancellationReason, string> = {
      MECHANICAL_ISSUE: 'Panne mécanique du triporteur',
      PERSONAL_EMERGENCY: 'Urgence personnelle',
      HEALTH_ISSUE: 'Problème de santé',
      OTHER: customReason?.trim() || 'Force majeure',
    };
    return labels[reason];
  }

  /**
   * Helper DRY pour les transitions d'état simples (utilisé en interne par
   * markArrived, startWash). Prend directement le profileId pour éviter
   * de re-fetch le profil.
   */
  private async transitionStatusInternal(
    profileId: string,
    bookingId: string,
    fromStatus: BookingStatus,
    toStatus: BookingStatus,
    extraData: Record<string, unknown>,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable');
    if (booking.washerId !== profileId) {
      throw new ForbiddenException("Cette réservation n'est pas la vôtre");
    }
    if (booking.status !== fromStatus) {
      throw new BadRequestException(
        `Impossible de passer de ${booking.status} à ${toStatus}`,
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: toStatus, ...extraData },
    });
  }

  /**
   * Helper privé : envoie une notif au client lors d'une transition de statut.
   */
  private async notifyClient(
    bookingId: string,
    washerProfileId: string,
    event: 'arrived' | 'started' | 'completed',
  ) {
    const [booking, washer] = await Promise.all([
      this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true },
      }),
      this.prisma.washerProfile.findUnique({
        where: { id: washerProfileId },
        include: { user: { select: { fullName: true } } },
      }),
    ]);
    if (!booking || !washer) return;

    let payload;
    if (event === 'arrived') {
      payload = NotificationMessages.washerArrived({
        userId: booking.clientId,
        bookingId,
        washerName: washer.user.fullName,
      });
    } else if (event === 'started') {
      payload = NotificationMessages.washStarted({
        userId: booking.clientId,
        bookingId,
        washerName: washer.user.fullName,
      });
    } else {
      payload = NotificationMessages.washCompletedByWasher({
        userId: booking.clientId,
        bookingId,
        washerName: washer.user.fullName,
      });
    }

    await this.notifications.enqueue(payload);
  }

  /**
   * Calcule les gains du laveur pour un mois donné.
   */
  async getEarnings(userId: string, year: number, month: number) {
    const profile = await this.getProfileByUserId(userId);

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const bookings = await this.prisma.booking.findMany({
      where: {
        washerId: profile.id,
        status: { in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
        createdAt: { gte: start, lt: end },
      },
      include: {
        client: { select: { fullName: true } },
        vehicle: { select: { brand: true, model: true, plate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED);
    const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED);

    const totalEarnedMAD = completed.reduce((sum, b) => sum + b.priceMAD, 0);
    const lostMAD = cancelled.reduce((sum, b) => sum + b.priceMAD, 0);

    return {
      year,
      month,
      kpi: {
        totalEarnedMAD,
        completedCount: completed.length,
        cancelledCount: cancelled.length,
        averagePerCourseMAD:
          completed.length > 0
            ? Math.round(totalEarnedMAD / completed.length)
            : 0,
        lostMAD,
      },
      bookings: bookings.map((b) => ({
        id: b.id,
        status: b.status,
        priceMAD: b.priceMAD,
        addressLabel: b.addressLabel,
        clientName: b.client.fullName,
        vehicleLabel: `${b.vehicle.brand} ${b.vehicle.model}`,
        vehiclePlate: b.vehicle.plate,
        createdAt: b.createdAt,
        completedAt: b.completedAt,
        cancellationReason: b.cancellationReason,
        cancelledBy: b.cancelledBy,
      })),
    };
  }

  async getEarningsMonths(userId: string) {
    const profile = await this.getProfileByUserId(userId);

    type MonthRow = { year: number; month: number; count: bigint };

    const result = await this.prisma.$queryRaw<MonthRow[]>`
      SELECT
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*) AS count
      FROM "Booking"
      WHERE "washerId" = ${profile.id}
        AND status IN ('COMPLETED', 'CANCELLED')
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    return result.map((r) => ({
      year: r.year,
      month: r.month,
      count: Number(r.count),
    }));
  }

  async updateCinPhoto(userId: string, buffer?: Buffer) {
    if (!buffer) throw new BadRequestException('Photo CIN requise');

    const profile = await this.getProfileByUserId(userId);

    const cinPhotoUrl = await this.cloudinary.uploadBuffer(buffer, 'washgo/cin');

    return this.prisma.washerProfile.update({
      where: { id: profile.id },
      data: { cinPhotoUrl },
      select: { cinPhotoUrl: true, verificationStatus: true },
    });
  }
}