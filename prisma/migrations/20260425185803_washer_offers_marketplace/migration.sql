-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WasherOffer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "washerId" TEXT NOT NULL,
    "proposedPriceMAD" INTEGER NOT NULL,
    "estimatedEtaMin" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasherOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WasherOffer_bookingId_status_idx" ON "WasherOffer"("bookingId", "status");

-- CreateIndex
CREATE INDEX "WasherOffer_washerId_status_idx" ON "WasherOffer"("washerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WasherOffer_bookingId_washerId_key" ON "WasherOffer"("bookingId", "washerId");

-- AddForeignKey
ALTER TABLE "WasherOffer" ADD CONSTRAINT "WasherOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasherOffer" ADD CONSTRAINT "WasherOffer_washerId_fkey" FOREIGN KEY ("washerId") REFERENCES "WasherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
