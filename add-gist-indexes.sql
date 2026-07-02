-- Enable PostGIS extension just in case it isn't active
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Create a spatial GiST index on the WasherProfile coordinates
CREATE INDEX IF NOT EXISTS "WasherProfile_location_gist_idx" 
ON "WasherProfile" USING gist (ST_SetSRID(ST_MakePoint("currentLng", "currentLat"), 4326));

-- 2. Create a spatial GiST index on the Booking coordinates
CREATE INDEX IF NOT EXISTS "Booking_location_gist_idx" 
ON "Booking" USING gist (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326));