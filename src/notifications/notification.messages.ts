import { NotificationPayload, NotificationType } from './notification.types';

interface MsgInput {
  userId: string;
  bookingId?: string;
  offerId?: string;
  data?: Record<string, unknown>;
}

export const NotificationMessages = {
  newBookingNearby(input: MsgInput & {
    distanceKm: number;
    suggestedPriceMAD: number;
    washTypeLabel: string;
    vehicleLabel: string;
  }): NotificationPayload {
    return {
      type: 'NEW_BOOKING_NEARBY',
      userId: input.userId,
      title: '🚗 Nouvelle course à proximité',
      body: `${input.vehicleLabel} · ${input.washTypeLabel} · à ${input.distanceKm.toFixed(1)} km · ${input.suggestedPriceMAD / 100} DH suggéré`,
      data: { bookingId: input.bookingId, ...input.data },
    };
  },

  offerReceived(input: MsgInput & {
    washerName: string;
    proposedPriceMAD: number;
    etaMin: number;
  }): NotificationPayload {
    return {
      type: 'OFFER_RECEIVED',
      userId: input.userId,
      title: '💰 Nouvelle offre',
      body: `${input.washerName} vous propose ${input.proposedPriceMAD / 100} DH (arrive en ~${input.etaMin} min)`,
      data: { bookingId: input.bookingId, offerId: input.offerId },
    };
  },

  offerAccepted(input: MsgInput & { clientName: string }): NotificationPayload {
    return {
      type: 'OFFER_ACCEPTED',
      userId: input.userId,
      title: '✅ Vous avez été choisi !',
      body: `${input.clientName} a accepté votre offre. Direction le client !`,
      data: { bookingId: input.bookingId },
    };
  },

  offerRejected(input: MsgInput): NotificationPayload {
    return {
      type: 'OFFER_REJECTED',
      userId: input.userId,
      title: 'Une autre offre a été choisie',
      body: "Le client a sélectionné un autre laveur. Continuez à chercher d'autres courses 💪",
      data: { bookingId: input.bookingId },
    };
  },

  washerArrived(input: MsgInput & { washerName: string }): NotificationPayload {
    return {
      type: 'WASHER_ARRIVED',
      userId: input.userId,
      title: '📍 Votre laveur est arrivé',
      body: `${input.washerName} est sur place. Allez à sa rencontre !`,
      data: { bookingId: input.bookingId },
    };
  },

  washStarted(input: MsgInput & { washerName: string }): NotificationPayload {
    return {
      type: 'WASH_STARTED',
      userId: input.userId,
      title: '🧽 Lavage commencé',
      body: `${input.washerName} a démarré le lavage de votre véhicule`,
      data: { bookingId: input.bookingId },
    };
  },

  washCompletedByWasher(input: MsgInput & { washerName: string }): NotificationPayload {
    return {
      type: 'WASH_COMPLETED_BY_WASHER',
      userId: input.userId,
      title: '✨ Lavage terminé',
      body: `${input.washerName} a fini. Confirmez la fin du lavage si tout est OK.`,
      data: { bookingId: input.bookingId },
    };
  },

  bookingConfirmedByClient(input: MsgInput & { clientName: string; priceMAD: number }): NotificationPayload {
    return {
      type: 'BOOKING_CONFIRMED_BY_CLIENT',
      userId: input.userId,
      title: '🎉 Course payée',
      body: `${input.clientName} a confirmé. ${input.priceMAD / 100} DH ajoutés à vos gains.`,
      data: { bookingId: input.bookingId },
    };
  },

  bookingCancelledByClient(input: MsgInput & { reason: string }): NotificationPayload {
    return {
      type: 'BOOKING_CANCELLED_BY_CLIENT',
      userId: input.userId,
      title: '❌ Course annulée',
      body: `Le client a annulé : ${input.reason}`,
      data: { bookingId: input.bookingId },
    };
  },

  bookingCancelledByWasher(input: MsgInput & { reason: string }): NotificationPayload {
    return {
      type: 'BOOKING_CANCELLED_BY_WASHER',
      userId: input.userId,
      title: '⚠️ Votre laveur a annulé',
      body: `Motif : ${input.reason}. Recherche d'un nouveau laveur en cours...`,
      data: { bookingId: input.bookingId },
    };
  },
};
