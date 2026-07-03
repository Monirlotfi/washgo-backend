export type NotificationType =
  | 'NEW_BOOKING_NEARBY'
  | 'OFFER_RECEIVED'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'WASHER_ARRIVED'
  | 'WASH_STARTED'
  | 'WASH_COMPLETED_BY_WASHER'
  | 'BOOKING_CONFIRMED_BY_CLIENT'
  | 'BOOKING_CANCELLED_BY_CLIENT'
  | 'BOOKING_CANCELLED_BY_WASHER'
  | 'BOOKING_REOPENED'
  | 'BOOKING_EXPIRED';

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
