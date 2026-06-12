-- CreateEnum
CREATE TYPE "WashType" AS ENUM ('BASIC', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('CITY_CAR', 'LARGE_VEHICLE', 'MOTORCYCLE');

-- CreateEnum
CREATE TYPE "WasherCancellationReason" AS ENUM ('MECHANICAL_ISSUE', 'PERSONAL_EMERGENCY', 'HEALTH_ISSUE', 'OTHER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "estimatedDurationMin" INTEGER,
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "washType" "WashType" NOT NULL DEFAULT 'BASIC',
ADD COLUMN     "washerCancelReason" "WasherCancellationReason";

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "category" "VehicleCategory";
