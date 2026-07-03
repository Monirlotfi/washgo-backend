-- Add missing indexes that are declared in the Prisma schema but were never created

-- User(createdAt) - used for sorting/admin queries
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- WasherProfile(currentLat, currentLng) - CRITICAL for spatial proximity queries
-- Used by findNearbyWashers() and getAvailableBookings() with ST_DistanceSphere
CREATE INDEX IF NOT EXISTS "WasherProfile_currentLat_currentLng_idx" ON "WasherProfile"("currentLat", "currentLng");

-- WasherProfile(isVerified) - used in every washer availability query
CREATE INDEX IF NOT EXISTS "WasherProfile_isVerified_idx" ON "WasherProfile"("isVerified");

-- Vehicle(userId) - used in all vehicle CRUD operations
CREATE INDEX IF NOT EXISTS "Vehicle_userId_idx" ON "Vehicle"("userId");

-- Booking(clientId, status) - used in findByClient() and cancelByClient()
CREATE INDEX IF NOT EXISTS "Booking_clientId_status_idx" ON "Booking"("clientId", "status");

-- Booking(lat, lng) - helps spatial queries and geo-range scans
CREATE INDEX IF NOT EXISTS "Booking_lat_lng_idx" ON "Booking"("lat", "lng");

-- Booking(createdAt) - used in earnings queries with EXTRACT(YEAR/MONTH FROM createdAt)
CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt");

-- WasherOffer(createdAt) - used in listMyPendingOffers() sorted by createdAt DESC
CREATE INDEX IF NOT EXISTS "WasherOffer_createdAt_idx" ON "WasherOffer"("createdAt");
