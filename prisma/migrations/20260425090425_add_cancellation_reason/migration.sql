-- CreateEnum
CREATE TYPE "CancellationActor" AS ENUM ('CLIENT', 'WASHER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledBy" "CancellationActor";
